// src/types/MathDocument.ts

export type CurriculumLevel = 'primary' | 'ks3' | 'gcse' | 'a-level';

export type ElementType =
  | 'expression' // LaTeX rendered equation
  | 'number_line' // marked axis with intervals
  | 'fraction_bar' // visual fraction block
  | 'place_value_chart' // column chart for digit place value
  | 'shape_2d' // circle, triangle, polygon, etc.
  | 'shape_3d' // cube, sphere, prism, etc.
  | 'angle_arc' // arc between lines with degree label
  | 'vector_arrow' // directed arrow with magnitude
  | 'coordinate_grid' // Cartesian axes + optional plotted points
  | 'function_curve' // plotted mathematical function
  | 'bar_chart' // statistical bar chart
  | 'pie_chart' // statistical pie chart
  | 'scatter_plot' // scatter plot with optional best-fit line
  | 'venn_diagram' // overlapping set circles
  | 'probability_tree' // branching probability tree
  | 'truth_table' // logical truth table grid
  | 'matrix_grid' // m×n matrix
  | 'trig_unit_circle' // annotated unit circle
  | 'long_division' // step-by-step division layout
  | 'algebra_balance' // balance scale for equations
  | 'factor_tree' // prime factorisation branches
  | 'number_bond' // number bond circle diagram
  | 'arrow' // connector / annotation arrow
  | 'freehand' // ink stroke
  | 'highlight' // semi-transparent overlay
  | 'sticky_note' // peer comment bubble
  | 'text_label' // plain text label
  | 'image_insert' // embedded image
  | 'table_grid'; // general-purpose editable table

export type MathElementContent = {
  // expression / text
  latex?: string; // e.g. "\frac{-b \pm \sqrt{b^2-4ac}}{2a}"
  text?: string;  // plain text or labels
  
  // number_line
  min?: number; // left bound
  max?: number; // right bound
  step?: number; // interval between marks
  markedPoints?: number[]; // highlighted points on the line
  
  // fraction_bar
  numerator?: string; // may itself be a latex string
  denominator?: string;
  
  // place_value_chart
  columns?: string[]; // ['Th','H','T','O'] etc.
  digits?: number[]; // value in each column
  
  // shape_2d / shape_3d
  shapeType?: string; // 'circle'|'triangle'|'rectangle'|'cube'|'sphere'...
  sides?: number; // for regular polygons

  // Statistics / charts
  labels?: string[];
  values?: number[];
  equation?: string;
};

export type MathElementStyle = {
  color?: string;      // line/text color (hex or rgb)
  fill?: string;       // fill color (hex, rgb, or none)
  stroke?: string;     // stroke/border color
  opacity?: number;    // e.g., 0.35 for highlights
  font?: string;       // font family/style
  borderStyle?: string; // solid, dashed, none
};

export interface MathElement {
  id: string;                      // Client-generated UUID
  sessionId: string;               // documentId of the canvas this element belongs to
  type: ElementType;               // One of the 28 element types
  x: number;                       // Position in canvas pixels x
  y: number;                       // Position in canvas pixels y
  width: number;                   // Bounding box width
  height: number;                  // Bounding box height
  rotation: number;                // Degrees clockwise, 0 by default
  zIndex: number;                  // Draw order
  content: MathElementContent;     // Type-specific data
  style: MathElementStyle;         // Color, fill, stroke, opacity, font
  createdBy: string;               // userId of the element creator
  createdAt: string;               // ISO Timestamp
  lastEditedBy?: string;           // Last editor userId
  lastEditedAt?: string;           // Last editor timestamp
  version: number;                 // Increments on change. Conflict detection gate.
  isDeleted: boolean;              // Soft delete ONLY.
  isAnnotation: boolean;           // True for comments/highlights overlay
  annotationTargetId: string | null; // Element ID this notes on, if any
  lockedBy: string | null;         // userId holding active lock
  lockedAt: string | null;         // lock timestamp
}

export type OperationType = 
  | 'create'
  | 'move'
  | 'resize'
  | 'edit_content'
  | 'delete'
  | 'restore'
  | 'annotate'
  | 'style_change';

export interface ElementOperation {
  id: string;              // Unique operation ID. Client-generated.
  sessionId: string;       // Canvas session this belongs to.
  elementId: string;       // Associated element id.
  operationType: OperationType;
  userId: string;          // User who did it
  userName: string;        // Display name at time of operation
  timestamp: string;       // ISO timestamp
  patch: Partial<MathElement>; // Fields changed (e.g. {x: 120, y: 85})
  previousPatch: Partial<MathElement>; // Undo snapshot before changes
  sessionVersion: number;  // session version count at operation moment
}

export interface CanvasSession {
  id: string;               // matches MathDocument.documentId
  threadId: string;         // chat thread/conversation this belongs to
  messageId: string;        // chat message containing the canvas
  parentSessionId: string | null; // session we forked from, if any
  subject: string;          // math subject (e.g., 'trigonometry')
  curriculumLevel: string;  // curriculum stage (e.g. 'primary' | 'ks3' | 'gcse' | 'a-level')
  createdBy: string;        // userId who sent original canvas
  createdAt: string;        // ISO timestamp
  chalkHolder: string | null; // userId of current editor, null if free
  chalkHolderName: string | null; // display name of chalk holder
  chalkAcquiredAt: string | null; // iso timestamp for stale detection
  activeUsers: string[];    // userIds currently viewing
  editChain: string[];      // ordered [original, fork1, fork2, ...]
  operationCount: number;   // total operations applied
}

export interface Presence {
  id: string;               // composite: sessionId + "_" + userId
  sessionId: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  x: number;
  y: number;
  tool: string;             // active tool
  isChalkHolder: boolean;
  updatedAt: string;        // ISO timestamp
}

export interface MathMeta {
  fileId: string;               // Appwrite storage file ID of .msgpack binary canvas file
  documentId: string;           // UUID matching MathDocument and CanvasSession records
  parentDocumentId: string | null; // UUID of parent canvas if fork. Null for originals.
  subject: string;              // e.g. 'trigonometry'
  curriculumLevel: CurriculumLevel; // curriculum stage
  thumbnailData: string;        // Base64 PNG data url
  elementCount: number;         // number of elements on canvas
  annotationCount: number;      // number of annotations
  chalkHolder: string | null;   // userId currently editing
  chalkHolderName: string | null; // Display name of editor
  versionChainIds?: string[];   // array of documentIds, oldest first
  versionFileIds?: string[];    // array of fileIds, oldest first
  versionAuthorIds?: string[];
  versionAuthorNames?: string[];
  versionAudioIds?: string[];   // array of audio message fileIds attached to each version
  currentVersionIndex?: number; // 0-based index into versionChainIds
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface MathDocument {
  documentId: string;
  parentDocumentId: string | null;
  subject: string;
  curriculumLevel: CurriculumLevel;
  viewport: Viewport;
  createdBy: string;
  createdAt: string;
  version: number;
  operations: ElementOperation[];
  elements: MathElement[];
  versionChainIds?: string[];   // array of documentIds, oldest first
  versionFileIds?: string[];    // array of fileIds, oldest first
  versionAuthorIds?: string[];
  versionAuthorNames?: string[];
  versionAudioIds?: string[];   // array of audio message fileIds attached to each version
  currentVersionIndex?: number; // 0-based index into versionChainIds
}
