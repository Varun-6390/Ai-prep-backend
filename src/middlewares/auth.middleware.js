const jwt = require("jsonwebtoken");
const blacklistTokenModel = require("../models/blacklist.model");


async function authUser(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Token not found"
        })
    }

    const blackListToken = await blacklistTokenModel.findOne({
        token
    })

    if(blackListToken){
        return res.status(401).json({
            message:"Invalid Token"
        })
    }


    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded

        next()
    } catch (error) {
        return res.status(401).json({
            message:"Invalid Token"
        })
    }
}

module.exports = {authUser}