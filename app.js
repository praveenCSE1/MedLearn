const express = require('express');
const { MongoClient,ServerApiVersion, ObjectID  } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const multer = require('multer');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
app.use(passport.initialize());
const PORT = 3500;

///GOOGLE AUTHENTICATION
passport.serializeUser((user, done) => {
  done(null, user.googleId); 
});
var a =0;

passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
app.use(session({
  secret: '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', 
  resave: true,
  saveUninitialized: true
}));

passport.use(new GoogleStrategy({
  clientID: '565973034924-a7h65f205dp4rcv2nc7cn4u3q2onh64q.apps.googleusercontent.com',
  clientSecret: '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',

  callbackURL: "://medlearn-4d6m.onrender.com/google/callback"
},
async function(accessToken, refreshToken, profile, cb) {
  try {
    
    let googleUser = await getGoogleUserByGoogleId(profile.id);

    if (!googleUser) {
     
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;

      
      googleUser = await saveNewGoogleUser({ googleId: profile.id, email: email || '' });
    }

    return cb(null, googleUser);
  } catch (error) {
    console.error("Error in GoogleStrategy:", error);
    return cb(error, null);
  }
}));

async function saveNewGoogleUser(user) {
  try {
    await client.connect();
    const db = client.db(dbName);

  
    const result = await db.collection('googleUsers').insertOne(user);

    
    return user;
  } catch (error) {
    console.error('Error in saveNewGoogleUser:', error);
    throw error;
  }
}

async function getGoogleUserByGoogleId(googleId) {
  try {
    await client.connect();
    const db = client.db(dbName);

   
    const user = await db.collection('googleUsers').findOne({ googleId: googleId });
    return user;
  } catch (error) {
    console.error('Error in getGoogleUserByGoogleId:', error);
    throw error;
  }
}
app.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    
    a=1;
    res.redirect('/');
  });



///MONGODB CONFIGURATION
const uri = 'mongodb+srv://admin1:9444571970aA@mycluster.rnws4sg.mongodb.net/mydb?retryWrites=true&w=majority';
const dbName = 'mydb';
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { fallthrough: false }));




app.use(bodyParser.json());

///ENDPOINT FOR REGISTRATION
app.post('/reg', async (req, res) => {
  try {
    await client.connect();
    const { email, password } = req.body;

    const db = client.db(dbName);

    
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
    }
    


    const newUser = { email, password };
  
    await db.collection('users').insertOne(newUser);

   return res.status(302).json({ redirect: '/login' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/login', async (req, res) => {
  try {
    await client.connect();
    const { email, password } = req.body;

    const db = client.db(dbName);

    const user = await db.collection('users').findOne({ email, password });
    if (user) {
      return res.status(200).json({ message: 'Login successful', redirect: '/' });
    } else {     
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

///upload video
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);

    const { title } = req.body;
    const filename = req.file.filename;


    await db.collection('videos').insertOne({ title, filename });

    res.redirect('/playlist');
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.use(express.static(path.join(__dirname, 'public')));
app.get('/playlist', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);

    
    const searchTerm = req.query.search || '';

  
    const filter = { title: { $regex: searchTerm, $options: 'i' } };

    
    const videos = await db.collection('videos').find(filter).toArray();

    res.render('playlist', { videos, searchTerm });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


const videoDirectory = path.join(__dirname, 'uploads');

app.get('/play/:videoId', async (req, res) => {
  try {
    const videoId = req.params.videoId;

    await client.connect();
    const db = client.db(dbName);


    const videoDetails = await db.collection('videos').findOne({ filename: videoId });

    if (!videoDetails) {
    
      return res.status(404).json({ message: 'Video not found' });
    }

    const { title, filename } = videoDetails;

 
    res.render('play', { title, filename });
  } catch (error) {
    console.error('Error in /play route:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


/////upload pdf files
const pdfDirectory = path.join(__dirname, 'pdfs');
app.use('/pdfs', express.static(pdfDirectory, { fallthrough: false }));

const st = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'pdfs')); 
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const up = multer({ storage: st });
app.post('/upload_pdf', up.single('pdf'), async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);

    const { title } = req.body;
    const { filename, originalname } = req.file;

    // Save PDF details to MongoDB
    await db.collection('pdfs').insertOne({ title, filename, originalname });

    res.redirect('/view-pdf');
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.get('/view-pdf', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);

    const searchTerm = req.query.search || '';

    // Define the search filter based on the title
    const filter = { title: { $regex: searchTerm, $options: 'i' } };

    
    const pdfs = await db.collection('pdfs').find(filter).toArray();

    res.render('view-pdf', { pdfs, searchTerm });
  } catch (error) {
    console.error('Error in /view-pdf route:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/disp-pdf/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(pdfDirectory, filename);

    // Send the PDF file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error in /disp-pdf route:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/logout', (req, res) => {
  
  res.redirect('/register');
});
app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upl.html'));
});
app.get('/mcq', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mcq.html'));
});
app.get('/upload_pdf', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'uploadpdf.html'));
});
app.get('/register', (req, res) => {
  
  isAuthenticated = true;
  
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/', (req, res) => {
  
  var isAuthenticated = isAuthenticated;
  res.sendFile(path.join(__dirname, 'public', 'home.html'), { isAuthenticated });
});



// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
