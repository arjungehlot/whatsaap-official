// The supplied WhatsApp Business API contract is kept byte-for-byte in
// whatsapp-business.openapi.json. This module only adds the pre-existing
// WACRM public endpoints so documentation consumers do not lose them.
const whatsappBusiness = require('./whatsapp-business.openapi.json');
const wacrmPublic = require('./send-messages.openapi.json');

module.exports = {
  ...whatsappBusiness,
  paths: { ...whatsappBusiness.paths, ...wacrmPublic.paths },
  components: {
    ...whatsappBusiness.components,
    schemas: { ...whatsappBusiness.components?.schemas, ...wacrmPublic.components?.schemas },
    securitySchemes: {
      ...whatsappBusiness.components?.securitySchemes,
      ...wacrmPublic.components?.securitySchemes,
    },
  },
};
