const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const blacklistTokenModel = require("../models/blacklist.model");
  

async function registerUserController(req, res) {
    const {username, email, password} = req.body

    if(!username || !email || !password){
        return res.status(400).json({
            message: "Please provide username, email and password"
        })
    }
    const isUserAlreadyExists = await userModel.findOne({
        $or: [{username}, {email}]
    })

    if(isUserAlreadyExists)
    {
        return res.status(400).json({
            message: "Account already exists"
        })
    }

    const hashed = await bcrypt.hash(password, 10)

    const user = await userModel.create({
        username,
        email,
        password:hashed
    })

    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn:"1d"}
    )
    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    })

    res.status(201).json({
        message:"User Registered Successfully",
        user:{
            id: user._id,
            username: user.username,
            email: user.email
        }
    })

}

async function loginUserController(req, res) {
    const {email, password} = req.body

    const user = await userModel.findOne({email})

    if(!user)
    {
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if(!isPasswordValid)
    {
        return res.status(400).json({
            message: "Invalid Email or password"
        })  
    }

    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn:"1d"}
    )
    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    })
    res.status(200).json({
        message: "User loggedIn Successfully",
        user: {
            id:user._id,
            username:user.username,
            email:user.email
        }
    })
}

async function logoutUserController(req, res) {

    const token = req.cookies.token

    if(token)
    {
        await blacklistTokenModel.create({ token })
    }

    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    })

    res.status(200).json({
        message:"User logged out successfully"
    })

}

async function getMeController(req, res) {
    const user = await userModel.findById(req.user.id)

    res.status(200).json({
        message:"User Fetched Successfully",
        user:{
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}

module.exports = {
    registerUserController, loginUserController, logoutUserController, getMeController
}