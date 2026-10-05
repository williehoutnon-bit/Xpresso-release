import type { MathElement, PathAnchor } from '../types/elements';
import type { ConstrainedPoint } from '../types/point';

export type MathOp =
| { op: 'ADD_ELEMENT'; docId: string; element: MathElement }
| { op: 'UPDATE_ELEMENT'; docId: string; id: string; patch: Partial<MathElement> }
| { op: 'DELETE_ELEMENT'; docId: string; id: string }
| { op: 'MOVE_ELEMENT'; docId: string; id: string; dx: number; dy: number }
| { op: 'ADD_ANCHOR'; docId: string; pathId: string; anchor: PathAnchor; atIndex: number }
| { op: 'UPDATE_ANCHOR'; docId: string; pathId: string; index: number; anchor: Partial<PathAnchor> }
| { op: 'SET_CONSTRAINT'; docId: string; pathId: string; anchorIndex: number; point: ConstrainedPoint }
| { op: 'CHALK_LOCK'; docId: string; userId: string }
| { op: 'CHALK_RELEASE'; docId: string; userId: string }
| { op: 'PREVIEW_ANCHOR'; docId: string; pathId: string; index: number; x: number; y: number }; // ephemeral — never persisted
