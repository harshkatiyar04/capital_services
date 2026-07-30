import './main.js';
import './animations.js';
import { initReviewGenerator } from './review-generator.js';
import { initOfficeMaps } from './office-maps.js';
import { initContactCoverageMap } from './coverage-map.js';

document.addEventListener('DOMContentLoaded', () => {
  initReviewGenerator();
  initOfficeMaps();
  initContactCoverageMap();
});
