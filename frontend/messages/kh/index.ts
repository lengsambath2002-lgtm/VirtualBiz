// One JSON file per namespace so each surface owns its own file. Add a namespace here and in every locale.
import meta from './meta.json';
import common from './common.json';
import marketing from './marketing.json';
import auth from './auth.json';
import shop from './shop.json';
import onboarding from './onboarding.json';
import seller from './seller.json';
import provider from './provider.json';
import order from './order.json';
import admin from './admin.json';
import team from './team.json';
import shopSettings from './shopSettings.json';
import receipt from './receipt.json';
import customerEdit from './customerEdit.json';

const messages = {
  meta,
  common,
  marketing,
  auth,
  shop,
  onboarding,
  seller,
  provider,
  order,
  admin,
  team,
  shopSettings,
  receipt,
  customerEdit,
};
export default messages;
