import { nanoid } from 'nanoid';

// version 1 → 2: add id + kind to every element
export const mathMigrations = {
1: (oldDoc: any) => {
const elements = (oldDoc.elements ?? []).map((el: any) => ({
...el,
id: el.id ?? nanoid(10),
kind: el.kind ?? inferKind(el), // see inferKind() below
zIndex: el.zIndex ?? 0,
locked: el.locked ?? false,
createdAt: el.createdAt ?? Date.now(),
updatedAt: el.updatedAt ?? Date.now(),
}));
return { ...oldDoc, elements };
}
};

function inferKind(el: any): string {
if (el.points) return 'freehand';
if (el.latex) return 'equation';
if (el.text) return 'text';
if (el.radius) return 'circle';
return 'freehand'; // safest fallback for unknown legacy shapes
}
