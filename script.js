document.getElementById('send').addEventListener('click', sendMessage);

async function sendMessage() {
  const msg = document.getElementById('userInput').value;
  if(!msg) return;
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg })
  });
  const data = await res.json();
  // Adjust to your Foundry response shape. This is an example:
  const botText = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
  document.getElementById('chat').innerText += `\nYou: ${msg}\nBot: ${botText}\n`;
}