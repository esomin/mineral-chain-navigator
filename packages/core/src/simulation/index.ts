export {
    computePropagationPath,
    DEFAULT_ATTENUATION_RATE,
    DEFAULT_IMPACT_THRESHOLD,
} from './compute-propagation.js';

export { calculateSupplyDeficit } from './calculate-deficit.js';

export {
    simulateCountryRestriction,
    type CountryRestrictionResult,
} from './country-restriction.js';

export {
    runSingleSimulation,
    runConcurrentSimulations,
    type SimulationOptions,
} from './run-simulation.js';
