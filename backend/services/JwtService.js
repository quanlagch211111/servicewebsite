const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const generalAccessToken = async (payload) => {
  const accessToken = jwt.sign({
    payload 
  }, process.env.ACCESS_TOKEN, { expiresIn: '3h' });

  return accessToken;
};

const generalResetPasswordToken = async (payload) => {
  const accessToken = jwt.sign({
    payload 
  }, process.env.PASSWORD_RESET_TOKEN, { expiresIn: '3h' });

  return accessToken;
};

const generalRefreshToken = async (payload) => {
  const refreshToken = jwt.sign({
    payload 
  }, process.env.REFRESH_TOKEN, { expiresIn: '365d' });

  return refreshToken;
};

const provideToken = (token) => {
  return new Promise(async (resolve, reject) => {
    try {
      jwt.verify(token, process.env.REFRESH_TOKEN, async (err, user) => {
        if (err) {
          return resolve({
            status: 'ERROR',
            message: 'Invalid refresh token',
          });
        }

        const { id, role, isAdmin } = user.payload;
        const newAccessToken = await generalAccessToken({ id, role, isAdmin });

        resolve({
          status: 'Success',
          accessToken: newAccessToken
        });
      });
    } catch (err) {
      reject({
        status: 'Error',
        message: err.message
      });
    }
  });
};

const verifyToken = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

module.exports = {
  generalAccessToken,
  generalRefreshToken,
  provideToken,
  generalResetPasswordToken,
  verifyToken
};
