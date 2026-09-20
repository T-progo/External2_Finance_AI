// Tipos principales de la plataforma Externaliza2

export type UserRole = 'admin' | 'asesor' | 'cliente';

export type DocumentStatus = 'pendiente' | 'procesado_ia' | 'validado' | 'contabilizado' | 'incidencia' | 'rechazado';

export type IncidentStatus = 'nueva' | 'en_revision' | 'resuelta' | 'cerrada';

export type IncidentOrigin = 'ia' | 'manual' | 'asesor';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  roles?: UserRole[];
  estado: 'activo' | 'inactivo';
  telefono?: string;
  ultimoAcceso?: Date;
  fechaAlta: Date;
  notasInternas?: string;
  // Campos específicos por rol
  clientesAsignados?: string[]; // Para asesores
  asesoresAsignados?: string[]; // Para clientes
  modulosActivos?: ModulosActivos; // Para clientes
  // Campos adicionales para clientes
  codigo?: string;
  tipoEmpresa?: string;
  provincia?: string;
  nombreFiscal?: string;
  cif?: string;
}

export interface ModulosActivos {
  subidaDocumentos: boolean;
  incidencias: boolean;
  asistenteE2: boolean;
  panelFinanciero: boolean;
  facturacion: boolean;
}

export interface Cliente {
  id: string;
  nif: string;
  razonSocial: string;
  nombreComercial?: string;
  tipoCliente?: 'personal' | 'empresa';
  personaContacto: string;
  telefono: string;
  email: string;
  direccionFiscal: string;
  asesoresAsignados: string[];
  modulosActivos: ModulosActivos;
  estado: 'activo' | 'inactivo';
  fechaAlta: Date;
}

export interface Documento {
  id: string;
  nombre: string;
  clienteId: string;
  asesorId: string | null;
  tipo: 'otro' | 'emitida_pdf' | 'recibida_pdf' | 'emitida_excel' | 'recibida_excel';
  estado: DocumentStatus;
  fechaSubida: Date;
  procesadoIA: boolean;
  tamaño: number;
  urlArchivo: string;
  nroAsientoERP?: string;
  datosIA?: DatosFacturaIA;
  incidencias?: string[];
}

export interface ApunteContable {
  cuenta: string;
  concepto: string;
  debe: number;
  haber: number;
}

export interface AsientoContable {
  fecha: Date;
  descripcion: string;
  apuntes: ApunteContable[];
}

export interface DatosFacturaIA {
  fechaFactura?: string;
  numeroFactura?: string;
  nifEmisor?: string;
  razonSocialEmisor?: string;
  nifReceptor?: string;
  razonSocialReceptor?: string;
  baseImponible?: number;
  tipoIVA?: number;
  cuotaIVA?: number;
  totalFactura?: number;
  nivelConfianza: number;
  tipoDocumento?: string;
  asientoContable?: AsientoContable;
  proveedor?: string; // Alias para razonSocialEmisor
  importeTotal?: number; // Alias para totalFactura
  fecha?: string; // Alias para fechaFactura
}

export interface Incidencia {
  id: string;
  documentoId?: string;
  clienteId: string;
  asesorId: string | null;
  estado: IncidentStatus;
  origen: IncidentOrigin;
  fechaCreacion: Date;
  fechaUltimaRespuesta?: Date;
  mensajes: MensajeIncidencia[];
}

export interface MensajeIncidencia {
  id: string;
  usuarioId: string;
  rol: UserRole;
  mensaje: string;
  fecha: Date;
  archivosAdjuntos?: ArchivoAdjunto[];
  esIA?: boolean; // Para distinguir mensajes de IA
}

export interface ArchivoAdjunto {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamaño: number;
  fechaSubida: Date;
}

export interface MetricasDashboard {
  documentosPendientes: number;
  facturasIA: number;
  incidenciasAbiertas: number;
  clientesActivos: number;
  asesoresActivos: number;
}

export interface ActividadReciente {
  id: string;
  tipo: 'documento' | 'incidencia' | 'contabilizacion' | 'usuario';
  descripcion: string;
  usuario: string;
  fecha: Date;
  enlace?: string;
}

export interface DatosFinancieros {
  clienteId: string;
  periodo: string;
  ingresos: number;
  gastos: number;
  resultado: number;
  margen: number;
  riesgoIA?: 'bajo' | 'medio' | 'alto';
  ultimoCierre?: Date;
}

// Financial document types for Panel Financiero
export type TipoDocumentoFinanciero = 'pyg' | 'balance' | 'mayor' | 'extracto' | 'excel' | 'otro_financiero';

export interface DocumentoFinanciero {
  id: string;
  clienteId: string;
  asesorId: string;
  nombre: string;
  tipo: TipoDocumentoFinanciero;
  periodo: string; // e.g., "Q1 2024", "2024", "Enero 2024"
  fechaSubida: Date;
  urlArchivo: string;
  tamaño: number;
  procesadoIA: boolean;
  datosExtraidos?: any; // JSON with extracted financial data
  analisisIA?: AnalisisFinancieroIA;
}

export interface AnalisisFinancieroIA {
  resumenGeneral: string;
  indicadoresClave: {
    ingresos?: number;
    gastos?: number;
    beneficio?: number;
    margen?: number;
    [key: string]: number | undefined;
  };
  alertas: AlertaFinanciera[];
  recomendaciones: string[];
  comparativas?: {
    periodo: string;
    cambio: number;
    porcentaje: number;
  }[];
  categoriaGastos?: {
    categoria: string;
    importe: number;
    porcentaje: number;
  }[];
}

export interface AlertaFinanciera {
  tipo: 'info' | 'warning' | 'danger';
  titulo: string;
  descripcion: string;
  metrica?: string;
  valor?: number;
}

export interface ConsultaFinanciera {
  id: string;
  clienteId: string;
  pregunta: string;
  respuesta: string;
  fecha: Date;
  documentosReferenciados?: string[];
}

// ============================================
// COMPLETE FINANCIAL SYSTEM TYPES
// ============================================

// ERP Integration
export interface ERPAsiento {
  id: string;
  clienteId: string;
  documentoId?: string;
  nroAsiento: string;
  fechaAsiento: Date;
  descripcion?: string;
  fechaImportacion: Date;
  archivoErpOrigen?: string;
  metodoMatch: 'automatico' | 'manual' | 'secuencial';
  confianzaMatch?: number;
  apuntes: ApunteContable[];
  totalDebe: number;
  totalHaber: number;
}

export interface ApunteContable {
  cuenta: string;
  concepto: string;
  debe: number;
  haber: number;
}

export interface AsientoContable {
  fecha: Date;
  descripcion: string;
  apuntes: ApunteContable[];
}

// Libro Registro (Invoice Record Book)
export interface LibroRegistro {
  id: string;
  clienteId: string;
  periodo: string;
  ejercicioFiscal: string;
  tipoLibro: 'emitidas' | 'recibidas' | 'bienes_inversion';
  fechaGeneracion: Date;
  generadoPor: string;
  urlArchivoExcel?: string;
  totalFacturas: number;
  totalBaseImponible: number;
  totalIva: number;
  totalImporte: number;
  documentosIncluidos: string[];
  estado: 'generado' | 'importado_erp' | 'contabilizado';
}

// AI Verification
export interface VerificacionIA {
  id: string;
  documentoId: string;
  asesorId?: string;
  fechaProcesamiento: Date;
  modeloIA: string;
  confianzaGlobal: number;
  confianzasCampos: Record<string, number>;
  accion?: 'validado' | 'rechazado' | 'pendiente_revision';
  fechaAccion?: Date;
  comentariosAsesor?: string;
  camposCorregidos?: Record<string, any>;
  usadoEntrenamiento: boolean;
}

// AI Performance Metrics
export interface MetricasIA {
  id: string;
  fecha: Date;
  periodo: 'diario' | 'semanal' | 'mensual';
  documentosProcesados: number;
  documentosValidados: number;
  documentosRechazados: number;
  precisionPromedio: number;
  precisionPorTipo: Record<string, number>;
  altaConfianza: number;
  mediaConfianza: number;
  bajaConfianza: number;
  erroresTotales: number;
  erroresPorTipo: Record<string, number>;
  tiempoProcesamientoPromedio: number;
  mejoraVsPeriodoAnterior?: number;
}

// Financial Model
export interface ModeloFinancieroCliente {
  id: string;
  clienteId: string;
  periodo: string;
  ejercicioFiscal: string;
  documentosFuente: string[];
  fechaCalculo: Date;
  
  // P&L
  ingresosOperacionales: number;
  gastosOperacionales: number;
  resultadoOperacional: number;
  gastosFinancieros: number;
  ingresosExtraordinarios: number;
  gastosExtraordinarios: number;
  resultadoAntesImpuestos: number;
  impuestos: number;
  resultadoNeto: number;
  
  // Balance Sheet
  activoCorriente: number;
  activoNoCorriente: number;
  totalActivo: number;
  pasivoCorriente: number;
  pasivoNoCorriente: number;
  patrimonioNeto: number;
  totalPasivoPatrimonio: number;
  
  // Financial Ratios
  ratioLiquidez: number;
  ratioSolvencia: number;
  ratioEndeudamiento: number;
  margenBruto: number;
  margenOperacional: number;
  margenNeto: number;
  roi: number;
  roe: number;
  
  // Cash Flow
  flujoEfectivoOperaciones?: number;
  flujoEfectivoInversion?: number;
  flujoEfectivoFinanciacion?: number;
  flujoEfectivoNeto?: number;
  
  // Breakdowns
  gastosPorCategoria?: Record<string, number>;
  ingresosPorLinea?: Record<string, number>;
  proveedoresPrincipales?: Array<{nombre: string; importe: number}>;
  clientesPrincipales?: Array<{nombre: string; importe: number}>;
  
  // AI Analysis
  alertasFinancieras?: AlertaFinanciera[];
  recomendacionesIA?: string[];
  comentarioIA?: string;
  nivelRiesgo?: 'bajo' | 'medio' | 'alto';
  factoresRiesgo?: string[];
}

// Audit Log
export interface AuditoriaFinanciera {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioRol: UserRole;
  accion: string;
  entidadTipo: string;
  entidadId: string;
  descripcion: string;
  datosAnteriores?: any;
  datosNuevos?: any;
  clienteId?: string;
  direccionIp?: string;
  userAgent?: string;
  fecha: Date;
}

// Notifications
export interface PreferenciasNotificaciones {
  id: string;
  usuarioId: string;
  notifDocumentosNuevos: boolean;
  notifDocumentosProcesados: boolean;
  notifIncidenciasNuevas: boolean;
  notifIncidenciasResueltas: boolean;
  notifLibroRegistroGenerado: boolean;
  notifAlertasFinancieras: boolean;
  notifResumenDiario: boolean;
  notifResumenSemanal: boolean;
  notifInappEnabled: boolean;
  umbralAlertaGastos?: number;
  umbralAlertaIngresos?: number;
}

export interface HistorialNotificacion {
  id: string;
  usuarioId: string;
  tipo: 'email' | 'inapp' | 'sms';
  categoria: 'documento' | 'incidencia' | 'financiero' | 'sistema';
  titulo: string;
  mensaje: string;
  enviado: boolean;
  fechaEnvio?: Date;
  leido: boolean;
  fechaLectura?: Date;
  enlace?: string;
  datosAdicionales?: any;
  createdAt: Date;
}

// Dashboard Metrics
export interface DashboardFinancieroAdmin {
  totalIngresos: number;
  totalGastos: number;
  resultadoGlobal: number;
  margenPromedio: number;
  clientesEnRiesgo: number;
  datosClientes: Array<{
    clienteId: string;
    nombreCliente: string;
    ingresos: number;
    gastos: number;
    resultado: number;
    margen: number;
    nivelRiesgo: 'bajo' | 'medio' | 'alto';
    ultimoCierre?: Date;
  }>;
  evolucionMensual: Array<{
    mes: string;
    ingresos: number;
    gastos: number;
    resultado: number;
  }>;
  distribucionGastos: Array<{
    categoria: string;
    importe: number;
    porcentaje: number;
  }>;
}

export interface DashboardFinancieroAsesor {
  clientesAsignados: number;
  totalIngresos: number;
  totalGastos: number;
  resultadoNeto: number;
  documentosPendientes: number;
  incidenciasAbiertas: number;
  clientesConAlertas: Array<{
    clienteId: string;
    nombreCliente: string;
    alertas: AlertaFinanciera[];
    resultado: number;
  }>;
}

export interface DashboardFinancieroCliente {
  tipoCliente: 'autonomo' | 'empresa';
  periodoActual: string;
  ingresos: number;
  gastos: number;
  resultadoNeto: number;
  margen: number;
  
  // For autonomos
  iva?: {
    base: number;
    cuota: number;
    tipo: number;
  };
  
  // For empresas
  ratiosFinancieros?: {
    liquidez: number;
    solvencia: number;
    rentabilidad: number;
  };
  
  // Common
  evolucionTrimestral?: Array<{
    trimestre: string;
    ingresos: number;
    gastos: number;
    resultado: number;
  }>;
  
  gastosCategorizados?: Array<{
    categoria: string;
    importe: number;
    porcentaje: number;
  }>;
  
  comentarioIA?: string;
  alertas?: AlertaFinanciera[];
}

// Export/Import structures
export interface LibroRegistroExportData {
  cliente: {
    nif: string;
    razonSocial: string;
  };
  periodo: string;
  facturas: Array<{
    fecha: string;
    numeroFactura: string;
    nifContraparte: string;
    razonSocialContraparte: string;
    baseImponible: number;
    tipoIVA: number;
    cuotaIVA: number;
    total: number;
    documentoId: string;
  }>;
  totales: {
    baseImponible: number;
    cuotaIVA: number;
    total: number;
  };
}

export interface ERPImportData {
  cliente: {
    nif: string;
  };
  periodo: string;
  asientos: Array<{
    nroAsiento: string;
    fecha: string;
    descripcion: string;
    apuntes: ApunteContable[];
    facturaAsociada?: {
      numeroFactura: string;
      nif: string;
      fecha: string;
      total: number;
    };
  }>;
}