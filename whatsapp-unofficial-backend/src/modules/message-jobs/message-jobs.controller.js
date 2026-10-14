import { createMessageJob, deleteMessageJobForUser, listMessageJobRecipients, listMessageJobs, removeMessageJobRecipient, updateMessageJobStatus } from "./message-jobs.service.js";

export async function postMessageJob(req, res, next) { try { res.status(201).json({ success: true, data: { job: await createMessageJob(req.user._id, req.validated.body) } }); } catch (error) { next(error); } }
export async function getMessageJobs(req, res, next) { try { res.json({ success: true, data: await listMessageJobs(req.user._id, req.validated.query) }); } catch (error) { next(error); } }
export async function getMessageJobRecipients(req, res, next) { try { res.json({ success: true, data: { recipients: await listMessageJobRecipients(req.user._id, req.validated.params.id) } }); } catch (error) { next(error); } }
export async function patchMessageJobStatus(req, res, next) { try { res.json({ success: true, data: { job: await updateMessageJobStatus(req.user._id, req.validated.params.id, req.validated.body.status) } }); } catch (error) { next(error); } }
export async function deleteMessageJobRecipient(req, res, next) { try { res.json({ success: true, data: await removeMessageJobRecipient(req.user._id, req.validated.params.id, req.validated.params.recipientId) }); } catch (error) { next(error); } }
export async function deleteMessageJob(req, res, next) { try { await deleteMessageJobForUser(req.user._id, req.validated.params.id); res.status(204).send(); } catch (error) { next(error); } }
