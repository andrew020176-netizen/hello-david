import { registerRootComponent } from 'expo';
import './webviewMatcherGuard';

const AppRoot = require('./AppRoot').default;

registerRootComponent(AppRoot);
