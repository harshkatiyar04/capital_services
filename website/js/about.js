import './main.js';
import './animations.js';
import { initCoverageMap } from './coverage-map.js';
import { initOfficeMaps } from './office-maps.js';

import { initTeamFlipCards } from './team-flip-cards.js';

document.addEventListener('DOMContentLoaded', () => {
  initOfficeMaps();
  initCoverageMap();
  initTeamFlipCards();
});
