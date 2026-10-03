const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'yourclub-secret-key-2024';

// ============ AUTH MIDDLEWARE ============
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.driver = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// ============ HEALTH CHECK ============
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'YourClub API is running',
    timestamp: new Date().toISOString()
  });
});

// ============ DRIVER LOGIN ============
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password required' });
    }
    
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('phone', phone)
      .limit(1);
    
    if (error) throw error;
    if (!drivers || drivers.length === 0) {
      return res.status(401).json({ error: 'Driver not found' });
    }
    
    const driver = drivers[0];
    const validPassword = await bcrypt.compare(password, driver.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const token = jwt.sign(
      { id: driver.id, phone: driver.phone, name: driver.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({ 
      success: true, 
      token: token,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicle_number: driver.vehicle_number,
        status: driver.status
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ GET DRIVER PROFILE ============
app.get('/api/driver/me', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', req.driver.id)
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, driver: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ UPDATE DUTY STATUS ============
app.post('/api/driver/duty', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    const { data, error } = await supabase
      .from('drivers')
      .update({ status: status })
      .eq('id', req.driver.id)
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Duty status updated', driver: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ GET UPCOMING RIDES ============
app.get('/api/rides/upcoming', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_id', req.driver.id)
      .eq('status', 'upcoming')
      .order('ride_date', { ascending: true });
    
    if (error) throw error;
    
    res.json({ success: true, rides: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ GET RIDE HISTORY ============
app.get('/api/rides/history', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_id', req.driver.id)
      .eq('status', 'completed')
      .order('ride_date', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    res.json({ success: true, rides: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ START RIDE ============
app.post('/api/rides/:id/start', authenticateToken, async (req, res) => {
  try {
    const { otp } = req.body;
    
    const { data: rides, error: fetchError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', req.params.id)
      .eq('driver_id', req.driver.id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!rides) return res.status(404).json({ error: 'Ride not found' });
    
    if (rides.otp && rides.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    const { data, error } = await supabase
      .from('rides')
      .update({ 
        status: 'ongoing',
        start_time: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Ride started', ride: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ END RIDE ============
app.post('/api/rides/:id/end', authenticateToken, async (req, res) => {
  try {
    const { signature } = req.body;
    
    const { data, error } = await supabase
      .from('rides')
      .update({ 
        status: 'completed',
        end_time: new Date().toISOString(),
        customer_signature: signature || null
      })
      .eq('id', req.params.id)
      .eq('driver_id', req.driver.id)
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Ride ended', ride: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ QUALITY CHECK SUBMIT ============
app.post('/api/quality-check', authenticateToken, async (req, res) => {
  try {
    const { vehicle_number, check_data, photos } = req.body;
    
    const { data, error } = await supabase
      .from('quality_checks')
      .insert([{
        driver_id: req.driver.id,
        vehicle_number: vehicle_number,
        check_data: check_data,
        photos: photos || []
      }])
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Quality check submitted', check: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SYNC DATA ============
app.get('/api/sync', authenticateToken, async (req, res) => {
  try {
    const [driverRes, upcomingRes, historyRes] = await Promise.all([
      supabase.from('drivers').select('*').eq('id', req.driver.id).single(),
      supabase.from('rides').select('*').eq('driver_id', req.driver.id).eq('status', 'upcoming'),
      supabase.from('rides').select('*').eq('driver_id', req.driver.id).eq('status', 'completed').limit(20)
    ]);
    
    res.json({
      success: true,
      driver: driverRes.data,
      upcoming: upcomingRes.data || [],
      history: historyRes.data || [],
      synced_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ YourClub API running on port ${PORT}`);
});
