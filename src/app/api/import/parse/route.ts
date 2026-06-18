import { auth } from "@/lib/auth";
import { parseSpreadsheetFile, type ParsedSheet } from "@/lib/import-helpers";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 1000;

export type ParseSpreadsheetResponse =
  | { success: true; data: ParsedSheet; truncated: boolean }
  | { success: false; message: string };

/**
 * POST /api/import/parse
 *
 * Recebe um arquivo de planilha (.xlsx/.xls) e devolve cabeçalho + linhas já normalizadas
 * como texto, reaproveitando `parseSpreadsheetFile` (mesma lógica usada anteriormente no client).
 *
 * Request:
 *   Content-Type: multipart/form-data
 *   Campo: "file" (File) — obrigatório, tamanho máximo de 5MB
 *
 * Response (200):
 *   { success: true, data: { headers: string[], rows: string[][] }, truncated: boolean }
 *   - `truncated` é `true` quando a planilha excedia 1000 linhas e foi cortada nesse limite.
 *
 * Response (400):
 *   { success: false, message: string }
 *   - arquivo ausente, tamanho excedido, planilha vazia ou arquivo corrompido/ilegível
 *
 * Response (401):
 *   { success: false, message: "Não autenticado" }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ success: false, message: "Não autenticado" } satisfies ParseSpreadsheetResponse, {
      status: 401,
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { success: false, message: "Requisição inválida: esperado multipart/form-data" } satisfies ParseSpreadsheetResponse,
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, message: "Nenhum arquivo enviado" } satisfies ParseSpreadsheetResponse, {
      status: 400,
    });
  }

  if (file.size === 0) {
    return Response.json({ success: false, message: "Arquivo vazio" } satisfies ParseSpreadsheetResponse, {
      status: 400,
    });
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return Response.json(
      { success: false, message: "Arquivo excede o limite de 5MB" } satisfies ParseSpreadsheetResponse,
      { status: 400 }
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return Response.json(
      { success: false, message: "Não foi possível ler o arquivo enviado" } satisfies ParseSpreadsheetResponse,
      { status: 400 }
    );
  }

  let parsed: ParsedSheet;
  try {
    parsed = parseSpreadsheetFile(buffer);
  } catch {
    return Response.json(
      {
        success: false,
        message: "Não foi possível processar essa planilha. Verifique se é um .xlsx ou .xls válido",
      } satisfies ParseSpreadsheetResponse,
      { status: 400 }
    );
  }

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return Response.json(
      { success: false, message: "Não encontramos dados nessa planilha" } satisfies ParseSpreadsheetResponse,
      { status: 400 }
    );
  }

  const truncated = parsed.rows.length > MAX_ROWS;
  const data: ParsedSheet = truncated ? { headers: parsed.headers, rows: parsed.rows.slice(0, MAX_ROWS) } : parsed;

  return Response.json({ success: true, data, truncated } satisfies ParseSpreadsheetResponse, { status: 200 });
}
