import { registerRootComponent } from 'expo';
import './webviewLearningPatch';

const AppRoot = require('./AppRoot').default;

registerRootComponent(AppRoot);
