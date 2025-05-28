console.log('testing');


// Global state
let currentMeetingId = null;
let currentSessionId = null;
let currentMeetingContent = null;
let jsonEditor = null;
let summaryJsonEditor = null;

// DOM Elements
const meetingList = document.getElementById('meetingList');
const createMeetingBtn = document.getElementById('createMeetingBtn');
const fileInput = document.getElementById('fileInput');
const noMeetingSelected = document.getElementById('noMeetingSelected');
const meetingDetails = document.getElementById('meetingDetails');
const contentViewer = document.getElementById('contentViewer');
const summaryJsonViewer = document.getElementById('summaryJsonViewer');
const summaryMarkdown = document.getElementById('summaryMarkdown');
const jsonPathInput = document.getElementById('jsonPathInput');
const convertToMarkdownBtn = document.getElementById('convertToMarkdownBtn');
const showJsonBtn = document.getElementById('showJsonBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const todoList = document.getElementById('todoList');

// URL State Management
function updateURLState() {
  const params = new URLSearchParams();
  if (currentMeetingId) params.set('meeting', currentMeetingId);
  if (currentTab) params.set('tab', currentTab);

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, '', newURL);
}

function loadURLState() {
  const params = new URLSearchParams(window.location.search);
  const meetingId = params.get('meeting');
  const tab = params.get('tab') || 'content';
  const path = params.get('path');

  if (meetingId) {
    selectMeeting(meetingId);
  }

  if (tab) {
    switchTab(tab);
  }

}

// Tab Management
let currentTab = 'content';
let currentJsonPath = '';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tab}Tab`);
  });
  updateURLState();
}

// Initialize JSON Editor
function initJsonEditor() {
  const options = {
    mode: 'view',
    modes: ['view', 'code'],
    onModeChange: function (newMode) {
      if (newMode === 'code') {
        jsonEditor.expandAll();
      }
    }
  };
  jsonEditor = new JSONEditor(contentViewer, options);
}

// Initialize Summary JSON Editor
function initSummaryJsonEditor() {
  const options = {
    mode: 'view',
    modes: ['view', 'code'],
    onModeChange: function (newMode) {
      if (newMode === 'code') {
        summaryJsonEditor.expandAll();
      }
    }
  };
  summaryJsonEditor = new JSONEditor(summaryJsonViewer, options);
}

// Get value by JSON path
function getValueByPath(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (part === '$') continue;
    if (current === undefined || current === null) return null;
    current = current[part];
  }

  return current;
}

// Event Listeners
createMeetingBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
sendMessageBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

convertToMarkdownBtn.addEventListener('click', convertToMarkdown);
showJsonBtn.addEventListener('click', showJson);

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Functions
function convertToMarkdown() {
  const path = jsonPathInput.value.trim();
  if (!path) return;

  try {
    const summaryData = summaryJsonEditor.get();
    const value = getValueByPath(summaryData, path);

    if (value === undefined || value === null) {
      alert('No value found at the specified path');
      return;
    }

    // Show raw content
    const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

    // Show markdown
    summaryJsonViewer.classList.add('hidden');
    summaryMarkdown.classList.remove('hidden');
    summaryMarkdown.textContent = content;

    // Update URL state
    currentJsonPath = path;
    updateURLState();
  } catch (error) {
    console.error('Error:', error);
    alert('Error converting to markdown');
  }
}

function showJson() {
  summaryJsonViewer.classList.remove('hidden');
  summaryMarkdown.classList.add('hidden');
  currentJsonPath = '';
  updateURLState();
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const content = await file.text();
    const response = await fetch('/meeting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: content
    });

    if (!response.ok) throw new Error('Failed to create meeting');

    const data = await response.json();
    loadMeetings();
    selectMeeting(data.id);
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to create meeting');
  }
}

async function loadMeetings() {
  try {
    const response = await fetch('/meeting');
    const data = await response.json();

    meetingList.innerHTML = data.meetings.map(meeting => `
            <div class="meeting-item" data-id="${meeting.id}">
                <div class="font-medium">${meeting.content.title || 'Untitled Meeting'}</div>
                <div class="text-sm text-gray-500">${new Date().toLocaleDateString()}</div>
            </div>
        `).join('');

    // Add click handlers to meeting items
    document.querySelectorAll('.meeting-item').forEach(item => {
      item.addEventListener('click', () => selectMeeting(item.dataset.id));
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function selectMeeting(meetingId) {
  currentMeetingId = meetingId;
  currentSessionId = `session_${Date.now()}`;

  // Update UI
  document.querySelectorAll('.meeting-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === meetingId);
  });

  noMeetingSelected.classList.add('hidden');
  meetingDetails.classList.remove('hidden');

  // Load meeting content
  try {
    const response = await fetch('/meeting');
    const data = await response.json();
    const meeting = data.meetings.find(m => m.id === meetingId);
    if (meeting) {
      currentMeetingContent = meeting.content;
      // Update JSON editor
      if (!jsonEditor) {
        initJsonEditor();
      }
      jsonEditor.set(meeting.content);
      jsonEditor.expandAll();
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // Load summary
  try {
    const response = await fetch(`/summary?meeting_id=${meetingId}`);
    const data = await response.json();

    // Initialize summary JSON editor if not exists
    if (!summaryJsonEditor) {
      initSummaryJsonEditor();
    }

    // Update summary JSON editor
    summaryJsonEditor.set(data);
    summaryJsonEditor.expandAll();

    // Reset markdown view
    summaryJsonViewer.classList.remove('hidden');
    summaryMarkdown.classList.add('hidden');
    jsonPathInput.value = '';

    // Update URL state
    updateURLState();
  } catch (error) {
    console.error('Error:', error);
  }

  // Load TODO list
  loadTodoList();

  // Clear chat
  chatMessages.innerHTML = '';
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || !currentMeetingId || !currentSessionId) return;

  // Add user message to chat
  const userMsgID = Math.random().toString(36).substring(2, 15);
  addMessageToChat(userMsgID, message, 'user');
  chatInput.value = '';

  // Start SSE connection and send message
  const eventSource = new EventSource(`/chat?meeting_id=${currentMeetingId}&session_id=${currentSessionId}&message=${encodeURIComponent(message)}`);
  const assistantMsgID = Math.random().toString(36).substring(2, 15);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
     // you can change this to your data structure
    addMessageToChat(assistantMsgID, data.data, 'assistant');
  };

  eventSource.onerror = () => {
    eventSource.close();
  };
}

let msgs = {};

function addMessageToChat(msgID, message, type) {
  if (msgs[msgID]) {
    msgs[msgID].textContent += message;
  } else {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    msgs[msgID] = messageDiv;
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Load TODO list
async function loadTodoList() {
  console.log('Loading TODO list for meeting:', currentMeetingId);
  try {
    // Clear previous todos
    todoList.innerHTML = '';
    
    const response = await fetch(`/todo?meeting_id=${currentMeetingId}`);
    const data = await response.json();
    
    if (data.todos && data.todos.length > 0) {
      // Create todo items
      const todoItems = data.todos.map(todo => {
        return `
          <div class="p-3 bg-white rounded shadow mb-2">
            <div class="font-medium">${todo.title}</div>
            <div class="flex justify-between mt-1">
              <span class="text-sm ${todo.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}">
                ${todo.status}
              </span>
              <span class="text-sm text-gray-600">
                ${todo.assigned || 'Unassigned'}
              </span>
            </div>
          </div>
        `;
      }).join('');
      
      todoList.innerHTML = todoItems;
    } else {
      todoList.innerHTML = '<div class="text-gray-500 text-center p-4">No TODO items found</div>';
    }
  } catch (error) {
    console.error('Error loading TODO list:', error);
    todoList.innerHTML = '<div class="text-red-500 text-center p-4">Failed to load TODO items</div>';
  }
}

// Initialize
loadMeetings();
loadURLState(); 