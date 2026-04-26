const express = require("express");
const mongoose = require("mongoose");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const bcrypt = require('bcrypt');

const app = express();
require('./auth/google');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use("/uploads", express.static("uploads"));
app.use(cookieParser());
app.use(passport.initialize());

const JWT_SECRET = 'super-secret-key';

//  JWT MIDDLEWARE 
function auth(req, res, next) {
    const token = req.cookies.mytoken;

    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = decodedUser;
        next();
    });
}

//  MULTER CONFIG 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

//  DB CONNECTION 
mongoose.connect('mongodb://127.0.0.1:27017/canteenDB')
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.error("Connection failed", err));
//  SCHEMA 
const userSchema = new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname: String,
    email: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    age: Number,
    password: { type: String, required: true },
    profilePic: String,
    date: { type: Date, default: Date.now }
}, { collection: 'Users' });

const Users = mongoose.model('Users', userSchema);


// GOOGLE AUTH 

// Start Google login
app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false
    })
);

// Callback
app.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',
        session: false
    }),
    async (req, res) => {

        const googleUser = req.user;

        try {
            //  find or create user
            let user = await Users.findOne({ email: googleUser.emails[0].value });

            if (!user) {
                user = await Users.create({
                    firstname: googleUser.name.givenName,
                    lastname: googleUser.name.familyName,
                    username: googleUser.id,
                    email: googleUser.emails[0].value,
                    password: "google-auth",
                    profilePic: googleUser.photos[0].value
                });
            }

            //  create JWT
            const token = jwt.sign({
                id: user._id,
                username: user.username,
                firstname: user.firstname,
                profilePic: user.profilePic
            }, JWT_SECRET, { expiresIn: '1h' });

            res.cookie('mytoken', token, { 
                httpOnly: true,
                sameSite: 'lax' 
            });

            res.redirect('/home');

        } catch (err) {
            console.log(err);
            res.redirect('/login');
        }
});
// Routes
app.get('/',(req,res) => {
    res.redirect('/login');
});

// Signup page
app.get('/signup', (req, res) => {
    res.render('signup', { message: null });
});

// Login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Home page 
app.get('/home', auth, async (req, res) => {
    try {
        //  fetch latest user data from DB
        const user = await Users.findById(req.user.id);
        res.render('home', { user });
    } catch {
        res.redirect('/login');
    }
});
// cart page
app.get('/cart', auth, (req, res) => {
    res.render('cart');
});

// Logout
app.get('/logout', (req, res) => {
    res.clearCookie('mytoken');
    res.redirect('/login');
});

// Menu
app.get('/menu', auth, (req, res) => {
    res.render('menu');
});

//  LOGIN 
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await Users.findOne({ username });

        if (!user) {
            return res.render('login', { error: "Invalid credentials" });
        }

        //  block Google users
        if (user.password === "google-auth") {
            return res.render('login', { error: "Use Google Login" });
        }
        const match= await bcrypt.compare(password, user.password);

        if (match) {

            const token = jwt.sign({
                id: user._id,
                username: user.username,
                firstname: user.firstname,
                profilePic: user.profilePic
            }, JWT_SECRET, { expiresIn: '1h' });

            res.cookie('mytoken', token, {
                httpOnly: true,
                sameSite: 'lax'
            });

            return res.redirect('/home');
        }

        return res.render('login', { error: "Invalid credentials" });

    } catch (err) {
        res.render('login', { error: "Server error" });
    }
});

//  SIGNUP 
app.post('/signup', upload.single('profilePic'), async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.render('signup', { message: "Passwords do not match" });
        }

        const UserExists = await Users.findOne({
            $or: [
                { username: req.body.username },
                { email: req.body.email }
            ]
        });

        if (UserExists) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.render('signup', { message: "Username or Email already exists" });
        }

        const profilePath = req.file ? `/uploads/${req.file.filename}` : null;
        const hashedPassword = await bcrypt.hash(password,10);

        const newuser = new Users({
            ...req.body,
            password: hashedPassword,
            profilePic: profilePath
        });

        await newuser.save();

        res.render('signup', { message: "Signup successful!" });

    } catch (err) {
        res.render('signup', { message: err.message });
    }
});

app.listen(3000, () => console.log("Server started on port 3000"));