const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const authMiddleware = (tokenType = "access") => (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token || !token.startsWith("Bearer ")) {
    return res.status(403).send("A token is required for authentication");
  }

  const tokenWithoutBearer = token.split(" ")[1];

  if (!tokenWithoutBearer) {
    return res.status(403).send("A token is required for authentication");
  }

  let secret;
  switch (tokenType) {
    case "access":
      secret = process.env.ACCESS_TOKEN;
      break;
    case "reset-password":
      secret = process.env.PASSWORD_RESET_TOKEN;
      break;
    case "refresh":
      secret = process.env.REFRESH_TOKEN;
      break;
    default:
      throw new Error("Invalid token type");
  }

  try {
    const decoded = jwt.verify(tokenWithoutBearer, secret);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(401).send("Invalid Token");
  }
};

const checkRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: "Authentication required" });
  }

  const userRole = req.user.payload.role;
  
  if (!roles.includes(userRole)) {
    return res.status(403).json({ 
      message: "Access denied. Insufficient permissions." 
    });
  }
  
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.user || (req.user.payload.role !== "ADMIN" && !req.user.payload.isAdmin)) {
    return res.status(403).json({ message: "Access denied. Only Admin can access this." });
  }
  next();
};

module.exports = { authMiddleware, checkRole, isAdmin };