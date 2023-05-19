const jwt = require("jsonwebtoken");
const secret = process.env.SECRET;

module.exports = {
    sign: (user) => {
        //access token 발급
        const payload = {
            user_wallet: user.user_wallet,
            user_nickname: user.user_nickname,
        };
        return jwt.sign(payload, secret, {
            algorithm: "HS256",
            expiresIn: "1m",
        });
    },
    verifyToken(token) {
        let decoded = null;
        try {
            decoded = jwt.verify(token, secret);
            return {
                ok: true,
                user_wallet: decoded.user_wallet,
                user_nickname: decoded.user_nickname,
            };
        } catch (e) {
            return {
                ok: false,
                message: e.message,
            };
        }
    },
    refresh: () => {
        return jwt.sign({}, secret, {
            algorithm: "HS256",
            expiresIn: "30d",
        });
    },
    refreshVerify: (token, userNickname) => {
        const query = "select token from user where user_nickname=?";
        const param = [userNickname];
        try {
            connection.query(query, param, function (err, result, fields) {
                const refreshToken = JSON.stringify(result[0].token);
                const refreshTokenData = JSON.parse(refreshToken);
                const wallet = JSON.stringify(result[0].user_wallet);
                const walletData = JSON.parse(wallet);
                if (token === refreshToken && userWallet === wallet) {
                    try {
                        jwt.verify(token, secret);
                        return true;
                    } catch (err) {
                        return false;
                    }
                } else {
                    return false;
                }
            });
        } catch (err) {
            return false;
        }
    },
};
