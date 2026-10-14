import * as service from "./admin.service.js";

export async function getUsers(req, res) { res.json({ success: true, data: await service.listUsers(req.validated.query) }); }
export async function getUserDetails(req, res) { res.json({ success: true, data: await service.getUserDetails(req.validated.params.id) }); }
export async function patchUserStatus(req, res) { res.json({ success: true, data: await service.updateUserStatus(req.validated.params.id, req.validated.body.accountStatus) }); }
export async function patchUserPlan(req, res) { res.status(201).json({ success: true, data: await service.assignUserPlan(req.validated.params.id, req.validated.body) }); }
export async function patchUserExpiry(req, res) { res.json({ success: true, data: await service.updateUserExpiry(req.validated.params.id, req.validated.body.expiryDate) }); }
export async function deleteUser(req, res) { res.json({ success: true, data: await service.deleteUserAccount(req.validated.params.id, req.user._id, req.validated.body.confirmation) }); }

export async function getFeatures(_req, res) { res.json({ success: true, data: { features: await service.listFeatures() } }); }
export async function postFeature(req, res) { res.status(201).json({ success: true, data: await service.createFeature(req.validated.body) }); }
export async function patchFeature(req, res) { res.json({ success: true, data: await service.updateFeature(req.validated.params.id, req.validated.body) }); }
export async function deleteFeature(req, res) { await service.deleteFeature(req.validated.params.id); res.json({ success: true }); }

export async function getPlans(_req, res) { res.json({ success: true, data: { plans: await service.listAdminPlans() } }); }
export async function postPlan(req, res) { res.status(201).json({ success: true, data: await service.createAdminPlan(req.validated.body) }); }
export async function patchPlan(req, res) { res.json({ success: true, data: await service.updateAdminPlan(req.validated.params.id, req.validated.body) }); }
export async function reorderPlans(req, res) { res.json({ success: true, data: { plans: await service.reorderAdminPlans(req.validated.body.planIds) } }); }
export async function duplicatePlan(req, res) { res.status(201).json({ success: true, data: await service.duplicateAdminPlan(req.validated.params.id, req.validated.body) }); }
export async function deletePlan(req, res) { await service.deleteAdminPlan(req.validated.params.id); res.json({ success: true }); }

export async function getSubscriptions(req, res) { const { page, limit, status } = req.validated.query; res.json({ success: true, data: await service.listAdminSubscriptions(page, limit, status) }); }
export async function getPayments(req, res) { const { page, limit, status } = req.validated.query; res.json({ success: true, data: await service.listAdminPayments(page, limit, status) }); }
