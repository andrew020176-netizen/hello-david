import { registerRootComponent } from 'expo';
import './woolworthsEngineV2';
import './woolworthsNetworkBridge';

const AppRoot = require('./AppRoot').default;

registerRootComponent(AppRoot);
