require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

// Path to your service account key JSON
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:8081',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ✅ FIXED: use '/*' instead of '*'
//app.options('/*', cors(corsOptions));

app.use(bodyParser.json());

// Middleware to verify Firebase ID token
async function verifyFirebaseToken(req, res, next) {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.uid = decodedToken.uid;
    next();
  } catch (err) {
    console.error('verifyFirebaseToken error:', err);
    return res.status(401).json({ error: 'Unauthorized: ' + err.message });
  }
}

// ===== PUBLIC ROUTES =====
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// All /api routes require auth
const api = express.Router();
api.use(verifyFirebaseToken);

// ================= PROFILE & ROLE ROUTES (used by login/register) =================

// GET /api/profile
api.get('/profile', async (req, res) => {
  try {
    const uid = req.uid;
    const db = admin.firestore();
    const doc = await db.collection('profiles').doc(uid).get();
    if (!doc.exists) {
      const newProfile = { uid, createdAt: new Date().toISOString() };
      await db.collection('profiles').doc(uid).set(newProfile);
      return res.json({ profile: newProfile });
    }
    return res.json({ profile: doc.data() });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/profile
api.post('/profile', async (req, res) => {
  try {
    const uid = req.uid;
    const { fullName, phone, userType } = req.body;
    if (!fullName || !phone || !userType) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: fullName, phone, userType' });
    }

    const db = admin.firestore();
    const userRef = db.collection('profiles').doc(uid);
    const doc = await userRef.get();
    const now = new Date().toISOString();

    if (doc.exists) {
      await userRef.set(
        { fullName, phone, userType, updatedAt: now },
        { merge: true }
      );
    } else {
      await userRef.set({
        uid,
        fullName,
        phone,
        userType,
        createdAt: now,
        updatedAt: now,
      });
    }

    const savedProfile = (await userRef.get()).data();
    return res.status(200).json({ profile: savedProfile });
  } catch (err) {
    console.error('POST /api/profile error:', err);
    return res.status(500).json({ error: 'Server error while saving profile' });
  }
});

// GET /api/user/role
api.get('/user/role', async (req, res) => {
  try {
    const uid = req.uid;
    const db = admin.firestore();
    const doc = await db.collection('profiles').doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const data = doc.data();
    return res.json({ role: data.userType });
  } catch (err) {
    console.error('GET /api/user/role error:', err);
    return res.status(500).json({ error: 'Server error retrieving role' });
  }
});

// ================= LISTINGS ROUTES (used by farmer/buyer pages) =================

// POST /api/listings – create listing
api.post('/listings', async (req, res) => {
  try {
    const uid = req.uid;
    const {
      cropType,
      variety,
      quantity,
      minimumPrice,
      suggestedPrice,
      description,
    } = req.body;

    if (!cropType || !variety || !quantity || !minimumPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = admin.firestore();
    const listingRef = db.collection('listings').doc(); // auto id
    const now = new Date().toISOString();

    const newListing = {
      id: listingRef.id,
      farmerUid: uid,
      cropType,
      variety,
      quantity,
      minimumPrice,
      suggestedPrice: suggestedPrice || null,
      description: description || '',
      createdAt: now,
      status: 'open',
    };

    await listingRef.set(newListing);
    res.status(201).json({ listing: newListing });
  } catch (err) {
    console.error('POST /api/listings error:', err);
    res.status(500).json({ error: 'Server error while creating listing' });
  }
});

// GET /api/listings – all listings for buyers
api.get('/listings', async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('listings').get();
    const listings = snapshot.docs.map((doc) => doc.data());
    res.json({ listings });
  } catch (err) {
    console.error('GET /api/listings error:', err);
    res.status(500).json({ error: 'Server error fetching listings' });
  }
});

// GET /api/listings/:id – single listing
api.get('/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    const doc = await db.collection('listings').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json({ listing: doc.data() });
  } catch (err) {
    console.error('GET /api/listings/:id error:', err);
    res.status(500).json({ error: 'Server error fetching listing detail' });
  }
});

// POST /api/predict-price – dummy suggested price
api.post('/predict-price', async (req, res) => {
  try {
    const { cropType, variety, quantity } = req.body;
    if (!cropType || !variety || !quantity) {
      return res
        .status(400)
        .json({ error: 'Missing required fields for prediction' });
    }
    const suggestedPrice = parseFloat(quantity) * 50; // placeholder logic
    res.json({ suggestedPrice });
  } catch (err) {
    console.error('POST /api/predict-price error:', err);
    res.status(500).json({ error: 'Server error during prediction' });
  }
});

app.use('/api', api);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
