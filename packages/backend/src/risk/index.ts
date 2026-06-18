export {
    computeNodeHHI,
    computeNodeRisk,
    computeEdgeRisk,
    flagHighRisk,
    normalizeScore,
    normalizeHHI,
    normalizeWGI,
    DEFAULT_HHI_WEIGHT,
    DEFAULT_WGI_WEIGHT,
    DEFAULT_TRADE_VOLUME_WEIGHT,
    DEFAULT_REGULATORY_WEIGHT,
} from './compute-risk.js';

export type { NodeRiskFactors, EdgeRiskFactors } from './compute-risk.js';

export {
    recalculateAffected,
    getAffectedEntityIds,
} from './recalculate-risk.js';

export { getRiskColor } from './get-risk-color.js';
