import axios from 'axios';
async function test() {
  const cpf = '14672049515'; // Lídice da Mata
  const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidato/buscar/por/cpf/2022/${cpf}`;
  try {
    const res = await axios.get(url);
    console.log('✅ Found:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}
test();
