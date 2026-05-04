const express = require("express")
const authController = require("../controller/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")

const authRouter = express.Router();


//register api
authRouter.post("/register",authController.registerUserController)

//login api
authRouter.post("/login",authController.loginUserController) 

//logout api
authRouter.get("/logout",authController.logoutUserController) 

//get-me api
authRouter.get("/get-me",authMiddleware.authUser,authController.getMeController)

module.exports = authRouter;