export const ESTADOS_SISTEMA = [
  'RECIBIDO',
  'DERIVADO',
  'EN PROCESO',
  'OBSERVADO',
  'RECHAZADO',
  'ATENDIDO',
  'ARCHIVADO'
] as const;

export type EstadoDocumento = typeof ESTADOS_SISTEMA[number];

export const PERFILES_SISTEMA = [
  'MESA_PARTES',
  'OPERADOR',
  'JEFE',
  'ADMINISTRADOR',
  'OTI'
] as const;

export type PerfilSistema = typeof PERFILES_SISTEMA[number];

export const ESTADOS_POR_PERFIL: Record<string, string[]> = {
  MESA_PARTES:      ['RECIBIDO', 'OBSERVADO', 'RECHAZADO'],
  OPERADOR:         ['EN PROCESO', 'DERIVADO', 'ATENDIDO', 'OBSERVADO'],
  JEFE:             ['DERIVADO', 'ATENDIDO', 'ARCHIVADO', 'RECHAZADO'],
  ADMINISTRADOR:    [...ESTADOS_SISTEMA],
  OTI:              [...ESTADOS_SISTEMA],
};
