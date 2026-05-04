const mongoose = require("mongoose");

const blacklistTokenSchema = new mongoose.Schema({
    token:{
        type: String,
        required:[true,"token is needed to be blacklisted."]
    }
},
{
    timestamps:true
}
)

const blacklistTokenModel = new mongoose.model("blacklistToken",blacklistTokenSchema);

module.exports = blacklistTokenModel;