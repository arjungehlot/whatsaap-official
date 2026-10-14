import { createAutomation, getAutomationDetails, listAutomations, updateAutomationStatus } from "./automations.service.js";

export async function getAutomations(req, res, next) { try { res.json({ success: true, data: await listAutomations(req.user._id) }); } catch (error) { next(error); } }
export async function getAutomationDetailsById(req, res, next) { try { res.json({ success: true, data: await getAutomationDetails(req.user._id, req.validated.params.id) }); } catch (error) { next(error); } }
export async function postAutomation(req, res, next) { try { res.status(201).json({ success: true, data: { automation: await createAutomation(req.user._id, req.validated.body) } }); } catch (error) { next(error); } }
export async function patchAutomationStatus(req, res, next) { try { res.json({ success: true, data: { automation: await updateAutomationStatus(req.user._id, req.validated.params.id, req.validated.body.status) } }); } catch (error) { next(error); } }
