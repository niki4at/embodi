// Shared anatomical body figure shape data. Extracted from PainBodyMap so the
// same tappable front/back regions can power both the pain check-in and the
// "pick exercises by body part" picker.

export type BodyPart =
  | 'head'
  | 'neck'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftArm'
  | 'rightArm'
  | 'leftForearm'
  | 'rightForearm'
  | 'leftHand'
  | 'rightHand'
  | 'chest'
  | 'abdomen'
  | 'leftThigh'
  | 'rightThigh'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftCalf'
  | 'rightCalf'
  | 'leftFoot'
  | 'rightFoot'
  | 'upperBack'
  | 'lowerBack'
  | 'leftGlute'
  | 'rightGlute'

export interface BodyPartShape {
  id: BodyPart
  shape: 'ellipse' | 'path'
  cx?: number
  cy?: number
  rx?: number
  ry?: number
  d?: string
}

export const FRONT_PARTS: BodyPartShape[] = [
  {
    id: 'head',
    shape: 'path',
    d: 'M 100 10 C 110 10, 118 15, 118 28 C 118 35, 115 42, 110 48 C 105 53, 100 55, 100 55 C 100 55, 95 53, 90 48 C 85 42, 82 35, 82 28 C 82 15, 90 10, 100 10 Z',
  },
  {
    id: 'neck',
    shape: 'path',
    d: 'M 92 55 L 88 72 C 88 72, 90 75, 100 75 C 110 75, 112 72, 112 72 L 108 55',
  },
  { id: 'leftShoulder', shape: 'ellipse', cx: 68, cy: 85, rx: 18, ry: 14 },
  { id: 'rightShoulder', shape: 'ellipse', cx: 132, cy: 85, rx: 18, ry: 14 },
  {
    id: 'chest',
    shape: 'path',
    d: 'M 82 75 C 82 75, 78 80, 78 95 L 78 130 C 78 135, 80 140, 85 142 L 100 145 L 115 142 C 120 140, 122 135, 122 130 L 122 95 C 122 80, 118 75, 118 75 Z',
  },
  {
    id: 'leftArm',
    shape: 'path',
    d: 'M 55 90 C 52 92, 50 95, 50 100 L 50 130 C 50 135, 51 138, 53 140 L 55 140 C 57 138, 58 135, 58 130 L 58 100 C 58 95, 57 92, 55 90 Z',
  },
  {
    id: 'rightArm',
    shape: 'path',
    d: 'M 145 90 C 148 92, 150 95, 150 100 L 150 130 C 150 135, 149 138, 147 140 L 145 140 C 143 138, 142 135, 142 130 L 142 100 C 142 95, 143 92, 145 90 Z',
  },
  {
    id: 'leftForearm',
    shape: 'path',
    d: 'M 53 142 C 51 144, 49 147, 49 152 L 48 185 C 48 188, 49 190, 51 192 L 53 192 C 55 190, 56 188, 56 185 L 55 152 C 55 147, 54 144, 53 142 Z',
  },
  {
    id: 'rightForearm',
    shape: 'path',
    d: 'M 147 142 C 149 144, 151 147, 151 152 L 152 185 C 152 188, 151 190, 149 192 L 147 192 C 145 190, 144 188, 144 185 L 145 152 C 145 147, 146 144, 147 142 Z',
  },
  { id: 'leftHand', shape: 'ellipse', cx: 52, cy: 202, rx: 9, ry: 12 },
  { id: 'rightHand', shape: 'ellipse', cx: 148, cy: 202, rx: 9, ry: 12 },
  {
    id: 'abdomen',
    shape: 'path',
    d: 'M 85 145 L 78 148 C 78 150, 77 155, 77 165 L 77 190 C 77 195, 78 198, 80 200 L 100 202 L 120 200 C 122 198, 123 195, 123 190 L 123 165 C 123 155, 122 150, 122 148 L 115 145 Z',
  },
  {
    id: 'leftThigh',
    shape: 'path',
    d: 'M 80 202 C 78 204, 76 208, 76 215 L 75 250 C 75 255, 76 260, 78 262 L 82 262 C 84 260, 85 255, 85 250 L 86 215 C 86 208, 84 204, 82 202 Z',
  },
  {
    id: 'rightThigh',
    shape: 'path',
    d: 'M 120 202 C 122 204, 124 208, 124 215 L 125 250 C 125 255, 124 260, 122 262 L 118 262 C 116 260, 115 255, 115 250 L 114 215 C 114 208, 116 204, 118 202 Z',
  },
  { id: 'leftKnee', shape: 'ellipse', cx: 80, cy: 272, rx: 11, ry: 14 },
  { id: 'rightKnee', shape: 'ellipse', cx: 120, cy: 272, rx: 11, ry: 14 },
  {
    id: 'leftCalf',
    shape: 'path',
    d: 'M 78 286 C 76 288, 74 292, 74 298 L 72 340 C 72 344, 73 346, 75 348 L 77 348 C 79 346, 80 344, 80 340 L 82 298 C 82 292, 80 288, 78 286 Z',
  },
  {
    id: 'rightCalf',
    shape: 'path',
    d: 'M 122 286 C 124 288, 126 292, 126 298 L 128 340 C 128 344, 127 346, 125 348 L 123 348 C 121 346, 120 344, 120 340 L 118 298 C 118 292, 120 288, 122 286 Z',
  },
  { id: 'leftFoot', shape: 'ellipse', cx: 76, cy: 365, rx: 11, ry: 18 },
  { id: 'rightFoot', shape: 'ellipse', cx: 124, cy: 365, rx: 11, ry: 18 },
]

export const BACK_PARTS: BodyPartShape[] = [
  FRONT_PARTS[0],
  FRONT_PARTS[1],
  FRONT_PARTS[2],
  FRONT_PARTS[3],
  {
    id: 'upperBack',
    shape: 'path',
    d: 'M 82 75 C 82 75, 78 80, 78 90 L 78 125 C 78 128, 79 130, 82 132 L 100 135 L 118 132 C 121 130, 122 128, 122 125 L 122 90 C 122 80, 118 75, 118 75 Z',
  },
  FRONT_PARTS[5],
  FRONT_PARTS[6],
  FRONT_PARTS[7],
  FRONT_PARTS[8],
  FRONT_PARTS[9],
  FRONT_PARTS[10],
  {
    id: 'lowerBack',
    shape: 'path',
    d: 'M 82 135 L 78 138 C 78 140, 77 145, 77 155 L 77 175 C 77 178, 78 180, 80 182 L 100 184 L 120 182 C 122 180, 123 178, 123 175 L 123 155 C 123 145, 122 140, 122 138 L 118 135 Z',
  },
  { id: 'leftGlute', shape: 'ellipse', cx: 85, cy: 195, rx: 15, ry: 18 },
  { id: 'rightGlute', shape: 'ellipse', cx: 115, cy: 195, rx: 15, ry: 18 },
  {
    id: 'leftThigh',
    shape: 'path',
    d: 'M 80 213 C 78 215, 76 219, 76 226 L 75 261 C 75 266, 76 271, 78 273 L 82 273 C 84 271, 85 266, 85 261 L 86 226 C 86 219, 84 215, 82 213 Z',
  },
  {
    id: 'rightThigh',
    shape: 'path',
    d: 'M 120 213 C 122 215, 124 219, 124 226 L 125 261 C 125 266, 124 271, 122 273 L 118 273 C 116 271, 115 266, 115 261 L 114 226 C 114 219, 116 215, 118 213 Z',
  },
  { id: 'leftKnee', shape: 'ellipse', cx: 80, cy: 283, rx: 11, ry: 14 },
  { id: 'rightKnee', shape: 'ellipse', cx: 120, cy: 283, rx: 11, ry: 14 },
  {
    id: 'leftCalf',
    shape: 'path',
    d: 'M 78 297 C 76 299, 74 303, 74 309 L 72 351 C 72 355, 73 357, 75 359 L 77 359 C 79 357, 80 355, 80 351 L 82 309 C 82 303, 80 299, 78 297 Z',
  },
  {
    id: 'rightCalf',
    shape: 'path',
    d: 'M 122 297 C 124 299, 126 303, 126 309 L 128 351 C 128 355, 127 357, 125 359 L 123 359 C 121 357, 120 355, 120 351 L 118 309 C 118 303, 120 299, 122 297 Z',
  },
  { id: 'leftFoot', shape: 'ellipse', cx: 76, cy: 376, rx: 11, ry: 18 },
  { id: 'rightFoot', shape: 'ellipse', cx: 124, cy: 376, rx: 11, ry: 18 },
]

export const PART_LABELS: Record<BodyPart, string> = {
  head: 'Head',
  neck: 'Neck',
  leftShoulder: 'Left shoulder',
  rightShoulder: 'Right shoulder',
  leftArm: 'Left arm',
  rightArm: 'Right arm',
  leftForearm: 'Left forearm',
  rightForearm: 'Right forearm',
  leftHand: 'Left hand',
  rightHand: 'Right hand',
  chest: 'Chest',
  abdomen: 'Abdomen',
  leftThigh: 'Left thigh',
  rightThigh: 'Right thigh',
  leftKnee: 'Left knee',
  rightKnee: 'Right knee',
  leftCalf: 'Left calf',
  rightCalf: 'Right calf',
  leftFoot: 'Left foot',
  rightFoot: 'Right foot',
  upperBack: 'Upper back',
  lowerBack: 'Lower back',
  leftGlute: 'Left glute',
  rightGlute: 'Right glute',
}
