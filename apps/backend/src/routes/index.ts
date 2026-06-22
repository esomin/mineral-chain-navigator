// API 라우트 정의
import { Router } from 'express';
import type { Request, Response } from 'express';
import { RiskController } from '../controllers/risk-controller.js';
import { GraphController } from '../controllers/graph-controller.js';
import { SimulationController } from '../controllers/simulation-controller.js';
import { store } from '../store.js';

const router = Router();
const riskController = new RiskController(store);
const graphController = new GraphController(store);
const simulationController = new SimulationController(store);

// === 리스크 라우트 ===

/** GET /api/risk/node/:nodeId - 특정 노드의 리스크 점수 조회 */
router.get('/risk/node/:nodeId', (req: Request, res: Response) => {
    const { nodeId } = req.params;
    const result = riskController.getNodeRisk(nodeId);

    if (!result) {
        res.status(404).json({ error: `노드를 찾을 수 없습니다: ${nodeId}`, statusCode: 404 });
        return;
    }

    res.json(result);
});

/** GET /api/risk/edge/:edgeId - 특정 엣지의 리스크 점수 조회 */
router.get('/risk/edge/:edgeId', (req: Request, res: Response) => {
    const { edgeId } = req.params;
    const result = riskController.getEdgeRisk(edgeId);

    if (!result) {
        res.status(404).json({ error: `엣지를 찾을 수 없습니다: ${edgeId}`, statusCode: 404 });
        return;
    }

    res.json(result);
});

/** POST /api/risk/recalculate - 모든 리스크 점수 재계산 */
router.post('/risk/recalculate', (_req: Request, res: Response) => {
    const results = riskController.recalculateAll();
    res.json(results);
});

// === 그래프 라우트 ===

/** GET /api/graph/nodes - 모든 노드 조회 */
router.get('/graph/nodes', (_req: Request, res: Response) => {
    const nodes = graphController.getNodes();
    res.json(nodes);
});

/** GET /api/graph/edges - 모든 엣지 조회 */
router.get('/graph/edges', (_req: Request, res: Response) => {
    const edges = graphController.getEdges();
    res.json(edges);
});

/** GET /api/graph - 전체 그래프 데이터(노드 + 엣지) 조회 */
router.get('/graph', (_req: Request, res: Response) => {
    const graph = graphController.getGraph();
    res.json(graph);
});

// === 시뮬레이션 라우트 ===

/** POST /api/simulation/run - 시뮬레이션 실행 */
router.post('/simulation/run', async (req: Request, res: Response) => {
    const { scenario } = req.body;

    if (!scenario || !scenario.id || !scenario.disruptions) {
        res.status(400).json({ error: '유효한 시나리오를 제공해야 합니다.', statusCode: 400 });
        return;
    }

    try {
        const result = await simulationController.runSimulation(scenario);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: '시뮬레이션 실행 중 오류가 발생했습니다.', statusCode: 500 });
    }
});

/** GET /api/simulation/:id - 시뮬레이션 결과 조회 */
router.get('/simulation/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const result = simulationController.getSimulationResult(id);

    if (!result) {
        res.status(404).json({ error: `시뮬레이션 결과를 찾을 수 없습니다: ${id}`, statusCode: 404 });
        return;
    }

    res.json(result);
});

export { router };
