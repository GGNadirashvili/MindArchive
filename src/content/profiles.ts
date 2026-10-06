// All "Thoughts" profiles. Each file in this folder holds a group of thinkers; add new files here.
import { CLASSICAL } from './classical'
import { EASTERN_ANCIENT } from './eastern-ancient'
import { ENLIGHTENMENT_A } from './enlightenment-a'
import { ENLIGHTENMENT_B } from './enlightenment-b'
import { LATE_ANCIENT } from './late-ancient'
import { MEDIEVAL_A } from './medieval-a'
import { MEDIEVAL_B } from './medieval-b'
import { NINETEENTH_A } from './nineteenth-a'
import { NINETEENTH_B } from './nineteenth-b'
import { NINETEENTH_C } from './nineteenth-c'
import { NINETEENTH_D } from './nineteenth-d'
import { PRESOCRATIC } from './presocratic'
import { RENAISSANCE } from './renaissance'
import { ROMAN } from './roman'
import { SEVENTEENTH } from './seventeenth'
import { TWENTIETH_A } from './twentieth-a'
import { TWENTIETH_B } from './twentieth-b'
import { TWENTIETH_C } from './twentieth-c'
import { TWENTIETH_D } from './twentieth-d'
import { TWENTIETH_E } from './twentieth-e'
import type { Profile } from './types'

export const PROFILES: Profile[] = [
  ...PRESOCRATIC,
  ...CLASSICAL,
  ...ROMAN,
  ...EASTERN_ANCIENT,
  ...LATE_ANCIENT,
  ...MEDIEVAL_A,
  ...MEDIEVAL_B,
  ...RENAISSANCE,
  ...SEVENTEENTH,
  ...ENLIGHTENMENT_A,
  ...ENLIGHTENMENT_B,
  ...NINETEENTH_A,
  ...NINETEENTH_B,
  ...NINETEENTH_C,
  ...NINETEENTH_D,
  ...TWENTIETH_A,
  ...TWENTIETH_B,
  ...TWENTIETH_C,
  ...TWENTIETH_D,
  ...TWENTIETH_E,
]
