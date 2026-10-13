const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const User = require('../models/User');
const { getCollectionModel } = require('../models/collection.factory');
const { error, plain } = require('../services/data.service');
const Profiles = getCollectionModel('profiles');
const Accounts = getCollectionModel('accounts');
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    user_metadata: { full_name: user.full_name, avatar_url: user.avatar_url },
  };
}
function sign(user, profile) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      account_id: profile.account_id,
      role: profile.account_role || 'owner',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}
function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('wacrm_token', token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
async function profileFor(userId) {
  return Profiles.findOne({ user_id: userId }).lean();
}
async function signup(req, res, next) {
  try {
    const { email, password, full_name = '' } = req.body || {};
    if (!email || !password || String(password).length < 8)
      throw error('Email and a password of at least 8 characters are required');
    if (await User.exists({ email: String(email).toLowerCase() }))
      throw error('This email is already registered', 409);
    const user = await User.create({
      email,
      password_hash: await bcrypt.hash(password, 12),
      full_name,
    });
    const accountId = randomUUID();
    const account = await Accounts.create({
      id: accountId,
      account_id: accountId,
      name: full_name || email,
      owner_user_id: user.id,
    });
    const profile = await Profiles.create({
      account_id: account.id,
      user_id: user.id,
      full_name,
      email,
      account_role: 'owner',
    });
    const access_token = sign(user, profile);
    setSessionCookie(res, access_token);
    res
      .status(201)
      .json({ user: publicUser(user), access_token, profile: plain(profile) });
  } catch (cause) {
    next(cause);
  }
}
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({
      email: String(email || '').toLowerCase(),
    });
    if (
      !user ||
      !(await bcrypt.compare(String(password || ''), user.password_hash))
    )
      throw error('Invalid email or password', 401);
    const profile = await profileFor(user.id);
    if (!profile) throw error('Your account profile is unavailable', 403);
    const access_token = sign(user, profile);
    setSessionCookie(res, access_token);
    res.json({ user: publicUser(user), access_token, profile: plain(profile) });
  } catch (cause) {
    next(cause);
  }
}
async function me(req, res, next) {
  try {
    const user = await User.findOne({ id: req.auth.sub });
    const profile = await profileFor(req.auth.sub);
    if (!user || !profile) throw error('Unauthorized', 401);
    res.json({ user: publicUser(user), profile: plain(profile) });
  } catch (cause) {
    next(cause);
  }
}
async function updateMe(req, res, next) {
  try {
    const values = req.body || {};
    const user = await User.findOne({ id: req.auth.sub });
    if (!user) throw error('Unauthorized', 401);
    if (values.email && values.email !== user.email)
      user.email = values.email.toLowerCase();
    if (values.password) {
      if (String(values.password).length < 8)
        throw error('Password must contain at least 8 characters');
      user.password_hash = await bcrypt.hash(values.password, 12);
      user.password_migration_required = false;
    }
    if (values.data?.full_name !== undefined)
      user.full_name = values.data.full_name;
    if (values.data?.avatar_url !== undefined)
      user.avatar_url = values.data.avatar_url;
    await user.save();
    await Profiles.updateOne(
      { user_id: user.id },
      {
        $set: {
          full_name: user.full_name,
          email: user.email,
          avatar_url: user.avatar_url,
          updated_at: new Date(),
        },
      }
    );
    res.json({ user: publicUser(user) });
  } catch (cause) {
    next(cause);
  }
}
function logout(_req, res) {
  res.clearCookie('wacrm_token', { path: '/' });
  res.status(204).end();
}
module.exports = { signup, login, me, updateMe, logout };
