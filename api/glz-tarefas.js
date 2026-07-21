// api/glz-tarefas.js
// Busca as tarefas do banco GLZ_TAREFAS no Notion e devolve simplificado pro gorilaz.html.
// Precisa da env var NOTION_TOKEN configurada no projeto Vercel (Settings > Environment Variables).

const DATA_SOURCE_ID = '380b9fd4-c946-804b-aef0-000bdd126b76';
const NOTION_VERSION = '2025-09-03';

module.exports = async (req, res) => {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'NOTION_TOKEN não configurado no Vercel.' });
    return;
  }

  try {
    const rows = [];
    let cursor;
    let hasMore = true;

    while (hasMore) {
      const body = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const r = await fetch(`https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await r.json();
      if (!r.ok) {
        res.status(r.status).json({ error: data.message || 'Erro na API do Notion.' });
        return;
      }

      (data.results || []).forEach(page => rows.push(parsePage(page)));
      hasMore = !!data.has_more;
      cursor = data.next_cursor;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ rows });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};

function parsePage(page) {
  const p = page.properties || {};
  return {
    id: page.id,
    nome: titleText(p.Nome),
    status: p.Status && p.Status.status ? p.Status.status.name : '',
    prioridade: p.Prioridade && p.Prioridade.select ? p.Prioridade.select.name : '',
    projeto: (p.Projeto && p.Projeto.multi_select) ? p.Projeto.multi_select.map(o => o.name) : [],
    tipo: (p.Tipo && p.Tipo.multi_select) ? p.Tipo.multi_select.map(o => o.name) : [],
    deadline: p.Deadline && p.Deadline.date ? p.Deadline.date.start : '',
    obs: richText(p.OBS)
  };
}

function titleText(prop) {
  if (!prop || !prop.title) return '';
  return prop.title.map(t => t.plain_text).join('');
}
function richText(prop) {
  if (!prop || !prop.rich_text) return '';
  return prop.rich_text.map(t => t.plain_text).join('');
}
