import {
  createCampaign,
  continueCampaignWithReplacement,
  deleteCampaign,
  getCampaign,
  listCampaignRecipients,
  listCampaigns,
  rerunCampaign,
  subscribeCampaignEvents,
  updateCampaign,
  updateCampaignStatus,
} from "./campaigns.service.js";

export async function getCampaigns(req, res, next) {
  try {
    res.json({ success: true, data: { campaigns: await listCampaigns(req.user._id, req.validated.query) } });
  } catch (error) {
    next(error);
  }
}

export async function getCampaignById(req, res, next) {
  try {
    res.json({ success: true, data: { campaign: await getCampaign(req.user._id, req.validated.params.id) } });
  } catch (error) {
    next(error);
  }
}

export async function getRecipients(req, res, next) {
  try {
    res.json({
      success: true,
      data: { recipients: await listCampaignRecipients(req.user._id, req.validated.params.id) },
    });
  } catch (error) {
    next(error);
  }
}

export function streamCampaignUpdates(req, res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const unsubscribe = subscribeCampaignEvents(req.user._id, send);
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  send({ type: "connected", at: new Date().toISOString() });

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}

export async function postCampaign(req, res, next) {
  try {
    res.status(201).json({ success: true, data: { campaign: await createCampaign(req.user._id, req.validated.body) } });
  } catch (error) {
    next(error);
  }
}

export async function patchCampaignStatus(req, res, next) {
  try {
    res.json({
      success: true,
      data: { campaign: await updateCampaignStatus(req.user._id, req.validated.params.id, req.validated.body) },
    });
  } catch (error) {
    next(error);
  }
}

export async function patchCampaign(req, res, next) {
  try {
    res.json({
      success: true,
      data: { campaign: await updateCampaign(req.user._id, req.validated.params.id, req.validated.body) },
    });
  } catch (error) {
    next(error);
  }
}

export async function postContinueCampaignWithReplacement(req, res, next) {
  try {
    res.json({
      success: true,
      data: { campaign: await continueCampaignWithReplacement(req.user._id, req.validated.params.id) },
    });
  } catch (error) {
    next(error);
  }
}

export async function postCampaignRerun(req, res, next) {
  try {
    res.json({
      success: true,
      data: { campaign: await rerunCampaign(req.user._id, req.validated.params.id) },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCampaignById(req, res, next) {
  try {
    await deleteCampaign(req.user._id, req.validated.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
