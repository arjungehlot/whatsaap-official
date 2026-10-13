const { createTenantModel } = require('./base');
module.exports = createTenantModel(
  'FlowNode',
  'flow_nodes',
  {
    flow_id: { type: String, required: true, index: true },
    node_key: String,
    node_type: { type: String, required: true },
    config: { type: Object, default: {} },
    position: { type: Object, default: null },
  },
  [[{ account_id: 1, flow_id: 1, node_key: 1 }, { unique: true }]]
);
