import axios from 'axios';
async function test() {
  const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/2022/2040602022/AL/6`;
  try {
    const res = await axios.get(url);
    console.log('✅ List Size:', res.data.candidatos.length);
    console.log('✅ First item Sample:', JSON.stringify(res.data.candidatos[0], null, 2));
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}
test();
