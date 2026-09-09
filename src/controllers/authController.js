import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { env } from "../config/env.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAME_SITE,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/"
};

export async function login(req, res) {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username: String(username).toLowerCase().trim() }).select("+passwordHash");
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ sub: admin._id.toString(), role: admin.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  res.cookie("admin_token", token, cookieOptions);
  res.json({ admin: { id: admin._id, username: admin.username, role: admin.role } });
}

export function logout(req, res) {
  res.clearCookie("admin_token", { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: env.COOKIE_SAME_SITE, path: "/" });
  res.json({ message: "Logged out" });
}

export function me(req, res) {
  res.json({ admin: req.admin });
}
