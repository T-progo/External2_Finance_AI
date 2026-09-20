import type { NextApiRequest, NextApiResponse } from 'next';

interface TokenResponse {
  id: string;
  auth_token: string;
  expires_in: number;
}

interface CompanyData {
  codigo: number;
  nifCif: string;
  nombre: string;
  nombreComercial: string;
  direccion: string;
  codigoPostal: number;
  poblacion: string;
  provincia: string;
  telefonos: string;
  email: string;
  nombrePersonaDeContacto: string;
  telefonoPersonaDeContacto: string;
  emailPersonaDeContacto: string;
  nombreRepresentante: string;
  nifRepresentante: string;
  fechaAlta: number;
  fechaBaja: number;
  disponeOpcionLaboral: boolean;
  disponeOpcionObligaciones: boolean;
  disponeOpcionFiscal: boolean;
  tipoOpcionFiscal: number;
  disponeOpcionRenta: boolean;
  disponeOpcionFacturacion: boolean;
  tipoOpcionFacturacion: number;
  tipoActividad: number;
  epigrafe: string;
  nombreActividad: string;
  cnae: string;
  fechaConstitucion: number;
  tipoEmpresa: number;
}

interface CompaniesResponse {
  resultadosTotales: number;
  numeroDePaginas: number;
  paginaActual: number;
  elementosPorPagina: number;
  elementosEnPagina: number;
  datos: CompanyData[];
}

/**
 * Get authentication token from external API
 */
async function getAuthToken(): Promise<string> {
  const clientSecret = process.env.DIEZ_API_CLIENT_SECRET;
  const username = process.env.DIEZ_API_USERNAME;
  const password = process.env.DIEZ_API_PASSWORD;
  const clientId = process.env.DIEZ_API_CLIENT_ID;

  if (!clientSecret || !username || !password || !clientId) {
    throw new Error('Missing required API credentials in environment variables');
  }

  const requestBody = {
    userName: username,
    password: password,
    clientId: clientId,
    clientSecret: clientSecret,
  };

  const response = await fetch('http://apierp.diezsoftware.com/api/Auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[getAuthToken] Error response:', errorText);
    throw new Error(`Failed to get auth token: ${response.status} ${response.statusText}`);
  }

  const data: TokenResponse = await response.json();
  
  if (!data.auth_token) {
    throw new Error('No auth token received from API');
  }

  return data.auth_token;
}

/**
 * Get client data by código from external API
 */
async function getClienteByCodigo(codigo: string): Promise<CompanyData | null> {
  const token = await getAuthToken();
  const codigoNumber = parseInt(codigo, 10);

  if (isNaN(codigoNumber)) {
    throw new Error(`Código inválido: ${codigo}`);
  }

  const response = await fetch(`http://apierp.diezsoftware.com/api/Company/getCompanies`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[getClienteByCodigo] Error response:', errorText);
    
    if (response.status === 404) {
      throw new Error(`Cliente con código ${codigo} no encontrado`);
    }
    
    throw new Error(`Failed to get cliente data: ${response.status} ${response.statusText}`);
  }

  const data: CompaniesResponse = await response.json();
  
  // Find the company with matching código
  const company = data.datos?.find((item) => item.codigo === codigoNumber);
  
  if (!company) {
    return null;
  }

  return company;
}

/**
 * API Route: Get client data by código
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { codigo } = req.body;

    if (!codigo) {
      return res.status(400).json({ error: 'Código es requerido' });
    }

    const clienteData = await getClienteByCodigo(codigo.toString());

    if (!clienteData) {
      return res.status(404).json({ 
        error: `Cliente con código ${codigo} no encontrado`,
        success: false 
      });
    }

    return res.status(200).json({ success: true, data: clienteData });
  } catch (error: any) {
    console.error('[API cliente] Error:', error);
    return res.status(500).json({
      error: error.message || 'Error al obtener datos del cliente',
    });
  }
}
