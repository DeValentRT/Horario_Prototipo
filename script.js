// Helpers
const DAY_INDEX = {
  "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4,
  "Viernes": 5, "Sábado": 6, "Domingo": 7
};
const BASE_HOUR = 8; // grid starts at 08:00
const ROW_HEIGHT = 60; // px per hour
const MAX_SAVED_CONFIGS = 10;

const qs = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => [...el.querySelectorAll(sel)];

// Variables globales
let editingCourseId = null;
let courses = JSON.parse(localStorage.getItem('courses')) || [];
let courseGroups = JSON.parse(localStorage.getItem('courseGroups')) || {};
let groupVisibility = JSON.parse(localStorage.getItem('groupVisibility')) || {};
let savedConfigs = JSON.parse(localStorage.getItem('savedConfigs')) || [];
let activeSavedId = null;

// Elementos del DOM
const modalBackdrop = qs('#modalBackdrop');
const openModalBtn = qs('#openModal');
const closeModalBtn = qs('#closeModal');
const cancelModalBtn = qs('#cancelModal');
const form = qs('#courseForm');
const modalTitle = qs('#modalTitle');
const submitBtn = qs('#submitBtn');
const deleteCourseBtn = qs('#deleteCourse');
const courseIdInput = qs('#courseId');
const scheduleGrid = qs('#scheduleGrid');
const coursesList = qs('#coursesList');
const emptyState = qs('#emptyState');
const toggleAllCoursesBtn = qs('#toggleAllCourses');

// Elementos de guardados
const saveModalBackdrop = qs('#saveModalBackdrop');
const closeSaveModalBtn = qs('#closeSaveModal');
const cancelSaveModalBtn = qs('#cancelSaveModal');
const saveConfigForm = qs('#saveConfigForm');
const saveCurrentConfigBtn = qs('#saveCurrentConfig');
const savedList = qs('#savedList');
const emptySavedState = qs('#emptySavedState');
const savedCount = qs('#savedCount');

// Funciones de utilidad
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h*60 + m;
}

function escapeHTML(str){
  return str.replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Funciones de agrupamiento
function getCourseGroupKey(course) {
  return `${course.name}|${course.section || ''}`;
}

function updateCourseGroups() {
  const groups = {};
  
  courses.forEach(course => {
    const groupKey = getCourseGroupKey(course);
    if (!groups[groupKey]) {
      groups[groupKey] = {
        name: course.name,
        section: course.section || '',
        color: course.color,
        courses: [],
        visible: groupVisibility[groupKey] !== false
      };
    }
    groups[groupKey].courses.push(course);
  });
  
  courseGroups = groups;
  saveGroupData();
  renderCourseGroups();
}

function saveGroupData() {
  localStorage.setItem('courseGroups', JSON.stringify(courseGroups));
  localStorage.setItem('groupVisibility', JSON.stringify(groupVisibility));
}

function saveCourses() {
  localStorage.setItem('courses', JSON.stringify(courses));
}

// Funciones de renderizado
function renderCourses() {
  qsa('.course').forEach(course => course.remove());
  
  courses.forEach(course => {
    renderCourse(course);
  });
  
  updateCourseGroups();
}

function renderCourse(course) {
  const dayCol = qsa('.day-col').find(col => col.dataset.day === course.day);
  if (!dayCol) return;
  
  const groupKey = getCourseGroupKey(course);
  const isVisible = groupVisibility[groupKey] !== false;
  
  const block = document.createElement('div');
  block.className = `course${isVisible ? '' : ' hidden'}`;
  block.style.background = course.color;
  block.dataset.id = course.id;
  block.dataset.group = groupKey;
  
  const startMin = toMinutes(course.start);
  const endMin = toMinutes(course.end);
  const topOffset = ((startMin - BASE_HOUR*60) / 60) * ROW_HEIGHT;
  const height = ((endMin - startMin) / 60) * ROW_HEIGHT;
  
  block.style.top = `${topOffset + 2}px`;
  block.style.height = `${Math.max(height - 4, 44)}px`;
  
  const typeHTML = course.type ? `<div class="meta">${escapeHTML(course.type)}</div>` : '';
  const roomHTML = course.room ? `<div class="meta">Aula: ${escapeHTML(course.room)}</div>` : '';
  
  block.innerHTML = `
    <div class="name">${escapeHTML(course.name)}${course.section ? ' · ' + escapeHTML(course.section) : ''}</div>
    ${typeHTML}
    ${roomHTML}
    <div class="meta">${course.start} – ${course.end}</div>
  `;
  
  block.addEventListener('click', (e) => {
    e.stopPropagation();
    const courseToEdit = courses.find(c => c.id === course.id);
    if (courseToEdit) {
      openModal(courseToEdit);
    }
  });
  
  dayCol.appendChild(block);
}

function renderCourseGroups() {
  coursesList.innerHTML = '';
  
  if (Object.keys(courseGroups).length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  const sortedGroups = Object.entries(courseGroups).sort((a, b) => {
    const nameA = a[1].name.toLowerCase();
    const nameB = b[1].name.toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
  
  sortedGroups.forEach(([groupKey, group]) => {
    const isVisible = groupVisibility[groupKey] !== false;
    
    const groupElement = document.createElement('div');
    groupElement.className = 'course-group';
    groupElement.dataset.groupKey = groupKey;
    
    const sessionDetails = group.courses.map(course => {
      const day = course.day.substring(0, 3);
      return `<div class="course-session">
                <span class="course-session-day">${day}</span>
                <span class="course-session-time">${course.start} - ${course.end}${course.room ? ` (${course.room})` : ''}</span>
              </div>`;
    }).join('');
    
    groupElement.innerHTML = `
      <div class="course-group-header">
        <div class="course-group-checkbox ${isVisible ? 'checked' : ''}"></div>
        <div class="course-group-color" style="background: ${group.color}"></div>
        <div class="course-group-info">
          <div class="course-group-name" title="${group.name}${group.section ? ' · ' + group.section : ''}">
            ${escapeHTML(group.name)}${group.section ? ' · ' + escapeHTML(group.section) : ''}
          </div>
          <p class="course-group-sessions">${group.courses.length} sesión${group.courses.length !== 1 ? 'es' : ''}</p>
        </div>
      </div>
      <div class="course-group-details">
        ${sessionDetails}
      </div>
    `;
    
    const checkbox = groupElement.querySelector('.course-group-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGroupVisibility(groupKey);
    });
    
    const groupHeader = groupElement.querySelector('.course-group-header');
    groupHeader.addEventListener('click', (e) => {
      if (e.target === checkbox) return;
      if (group.courses.length > 0) {
        openModal(group.courses[0]);
      }
    });
    
    coursesList.appendChild(groupElement);
  });
}

function toggleGroupVisibility(groupKey) {
  groupVisibility[groupKey] = !groupVisibility[groupKey];
  
  qsa(`.course[data-group="${groupKey}"]`).forEach(course => {
    course.classList.toggle('hidden', !groupVisibility[groupKey]);
  });
  
  const groupElement = qs(`.course-group[data-group-key="${groupKey}"]`);
  if (groupElement) {
    const checkbox = groupElement.querySelector('.course-group-checkbox');
    checkbox.classList.toggle('checked', groupVisibility[groupKey]);
  }
  
  saveGroupData();
}

function toggleAllCourses() {
  const allGroups = Object.keys(courseGroups);
  if (allGroups.length === 0) return;
  
  const allVisible = allGroups.every(key => groupVisibility[key] !== false);
  
  allGroups.forEach(key => {
    groupVisibility[key] = allVisible ? false : true;
    
    qsa(`.course[data-group="${key}"]`).forEach(course => {
      course.classList.toggle('hidden', allVisible);
    });
  });
  
  qsa('.course-group-checkbox').forEach(checkbox => {
    checkbox.classList.toggle('checked', !allVisible);
  });
  
  saveGroupData();
}

// Funciones de guardados
function saveSavedConfigs() {
  localStorage.setItem('savedConfigs', JSON.stringify(savedConfigs));
  updateSavedCount();
}

function updateSavedCount() {
  savedCount.textContent = `(${savedConfigs.length}/${MAX_SAVED_CONFIGS})`;
}

function renderSavedConfigs() {
  savedList.innerHTML = '';
  
  if (savedConfigs.length === 0) {
    emptySavedState.style.display = 'block';
    saveCurrentConfigBtn.disabled = false;
    return;
  }
  
  emptySavedState.style.display = 'none';
  saveCurrentConfigBtn.disabled = savedConfigs.length >= MAX_SAVED_CONFIGS;
  
  savedConfigs.forEach((config, index) => {
    const isActive = config.id === activeSavedId;
    
    const savedItem = document.createElement('div');
    savedItem.className = `saved-item ${isActive ? 'active' : ''}`;
    savedItem.dataset.configId = config.id;
    
    savedItem.innerHTML = `
      <div class="saved-item-header">
        <div class="saved-item-radio"></div>
        <p class="saved-item-name">${escapeHTML(config.name)}</p>
        <button class="saved-item-delete" title="Eliminar">×</button>
      </div>
      ${config.description ? `<p class="saved-item-description">${escapeHTML(config.description)}</p>` : ''}
    `;
    
    // Aplicar configuración
    savedItem.addEventListener('click', (e) => {
      if (!e.target.classList.contains('saved-item-delete')) {
        applySavedConfig(config.id);
      }
    });
    
    // Eliminar configuración
    const deleteBtn = savedItem.querySelector('.saved-item-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSavedConfig(config.id);
    });
    
    savedList.appendChild(savedItem);
  });
}

function applySavedConfig(configId) {
  const config = savedConfigs.find(c => c.id === configId);
  if (!config) return;
  
  // Aplicar visibilidad guardada
  Object.keys(courseGroups).forEach(groupKey => {
    const shouldBeVisible = config.visibility[groupKey] !== false;
    groupVisibility[groupKey] = shouldBeVisible;
    
    // Actualizar en el horario
    qsa(`.course[data-group="${groupKey}"]`).forEach(course => {
      course.classList.toggle('hidden', !shouldBeVisible);
    });
    
    // Actualizar en el sidebar
    const groupElement = qs(`.course-group[data-group-key="${groupKey}"]`);
    if (groupElement) {
      const checkbox = groupElement.querySelector('.course-group-checkbox');
      checkbox.classList.toggle('checked', shouldBeVisible);
    }
  });
  
  activeSavedId = configId;
  saveGroupData();
  renderSavedConfigs();
}

function saveCurrentConfiguration() {
  if (savedConfigs.length >= MAX_SAVED_CONFIGS) {
    alert(`Has alcanzado el máximo de ${MAX_SAVED_CONFIGS} configuraciones guardadas. Elimina alguna antes de guardar una nueva.`);
    return;
  }
  
  // Mostrar modal de guardado
  saveModalBackdrop.style.display = 'flex';
  qs('#saveName').focus();
}

function createSavedConfig(name, description = '') {
  const config = {
    id: generateId(),
    name: name.trim(),
    description: description.trim(),
    date: new Date().toISOString(),
    visibility: { ...groupVisibility }
  };
  
  savedConfigs.unshift(config); // Agregar al principio
  if (savedConfigs.length > MAX_SAVED_CONFIGS) {
    savedConfigs.splice(MAX_SAVED_CONFIGS); // Mantener solo los primeros MAX
  }
  
  saveSavedConfigs();
  renderSavedConfigs();
  activeSavedId = config.id;
}

function deleteSavedConfig(configId) {
  if (!confirm('¿Estás seguro de que quieres eliminar esta configuración guardada?')) {
    return;
  }
  
  savedConfigs = savedConfigs.filter(config => config.id !== configId);
  
  if (activeSavedId === configId) {
    activeSavedId = null;
  }
  
  saveSavedConfigs();
  renderSavedConfigs();
}

// Funciones de modal (cursos)
function openModal(course = null) {
  if (course) {
    modalTitle.textContent = 'Editar curso';
    submitBtn.textContent = 'Guardar';
    deleteCourseBtn.style.display = 'block';
    
    qs('#name').value = course.name;
    qs('#section').value = course.section || '';
    qs('#color').value = course.color;
    qs('#day').value = course.day;
    qs('#room').value = course.room || '';
    qs('#start').value = course.start;
    qs('#end').value = course.end;
    qs('#type').value = course.type || '';
    courseIdInput.value = course.id;
    
    editingCourseId = course.id;
  } else {
    modalTitle.textContent = 'Añadir curso';
    submitBtn.textContent = 'Añadir';
    deleteCourseBtn.style.display = 'none';
    courseIdInput.value = '';
    editingCourseId = null;
  }
  modalBackdrop.style.display = 'flex';
}

function closeModal() {
  modalBackdrop.style.display = 'none';
  form.reset();
  qs('#color').value = '#4f46e5';
  qs('#type').value = '';
  editingCourseId = null;
}

// Funciones de modal (guardados)
function openSaveModal() {
  saveModalBackdrop.style.display = 'flex';
  qs('#saveName').value = '';
  qs('#saveDescription').value = '';
  qs('#saveName').focus();
}

function closeSaveModal() {
  saveModalBackdrop.style.display = 'none';
  saveConfigForm.reset();
}

// Funciones de cursos
function addOrUpdateCourse(courseData) {
  if (editingCourseId) {
    const index = courses.findIndex(c => c.id === editingCourseId);
    if (index !== -1) {
      const oldGroupKey = getCourseGroupKey(courses[index]);
      courses[index] = { ...courseData, id: editingCourseId };
      const newGroupKey = getCourseGroupKey(courses[index]);
      
      if (oldGroupKey !== newGroupKey && groupVisibility[oldGroupKey] !== undefined) {
        groupVisibility[newGroupKey] = groupVisibility[oldGroupKey];
      }
    }
  } else {
    courseData.id = generateId();
    courses.push(courseData);
    
    const groupKey = getCourseGroupKey(courseData);
    if (groupVisibility[groupKey] === undefined) {
      groupVisibility[groupKey] = true;
    }
  }
  
  saveCourses();
  renderCourses();
  
  // Desactivar guardado activo si hubo cambios
  if (activeSavedId) {
    activeSavedId = null;
    renderSavedConfigs();
  }
}

function deleteCourse(id) {
  if (confirm('¿Estás seguro de que quieres eliminar este curso?')) {
    const courseIndex = courses.findIndex(course => course.id === id);
    if (courseIndex !== -1) {
      const course = courses[courseIndex];
      const groupKey = getCourseGroupKey(course);
      
      courses.splice(courseIndex, 1);
      
      const remainingInGroup = courses.filter(c => getCourseGroupKey(c) === groupKey);
      if (remainingInGroup.length === 0) {
        delete groupVisibility[groupKey];
      }
      
      saveCourses();
      renderCourses();
      
      // Desactivar guardado activo
      if (activeSavedId) {
        activeSavedId = null;
        renderSavedConfigs();
      }
    }
    closeModal();
  }
}

// Event Listeners
openModalBtn.addEventListener('click', () => openModal());
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

deleteCourseBtn.addEventListener('click', () => {
  if (editingCourseId) {
    deleteCourse(editingCourseId);
  }
});

toggleAllCoursesBtn.addEventListener('click', toggleAllCourses);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = qs('#name').value.trim();
  const section = qs('#section').value.trim();
  const day = qs('#day').value;
  const start = qs('#start').value;
  const end = qs('#end').value;
  const color = qs('#color').value;
  const type = qs('#type').value;
  const room = qs('#room').value.trim();
  
  if (!name || !day || !start || !end) return;
  
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (endMin <= startMin) {
    alert('La hora de fin debe ser mayor a la de inicio.');
    return;
  }
  
  const courseData = {
    name,
    section,
    day,
    start,
    end,
    color,
    type,
    room
  };
  
  addOrUpdateCourse(courseData);
  closeModal();
});

// Event Listeners para guardados
saveCurrentConfigBtn.addEventListener('click', saveCurrentConfiguration);

closeSaveModalBtn.addEventListener('click', closeSaveModal);
cancelSaveModalBtn.addEventListener('click', closeSaveModal);
saveModalBackdrop.addEventListener('click', (e) => {
  if (e.target === saveModalBackdrop) closeSaveModal();
});

saveConfigForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = qs('#saveName').value.trim();
  const description = qs('#saveDescription').value.trim();
  
  if (!name) {
    alert('Por favor ingresa un nombre para la configuración.');
    return;
  }
  
  if (name.length > 50) {
    alert('El nombre debe tener máximo 50 caracteres.');
    return;
  }
  
  if (description.length > 200) {
    alert('La descripción debe tener máximo 200 caracteres.');
    return;
  }
  
  createSavedConfig(name, description);
  closeSaveModal();
});

// Inicializar
function init() {
  renderCourses();
  renderSavedConfigs();
  updateSavedCount();
}

// Ejecutar al cargar
document.addEventListener('DOMContentLoaded', init);