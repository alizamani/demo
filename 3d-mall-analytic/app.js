(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const metricDefs = {
    visits: { label: 'Footfall', shortLabel: 'Visits', unit: 'visits/h', min: 0, max: 1800, decimals: 0, mode: 'pressure' },
    workers: { label: 'Active workers', shortLabel: 'Workers', unit: 'devices', min: 0, max: 70, decimals: 0, mode: 'pressure' },
    dwell: { label: 'Avg dwell time', shortLabel: 'Dwell', unit: 'min', min: 0, max: 95, decimals: 1, mode: 'pressure' },
    queue: { label: 'Queue pressure', shortLabel: 'Queue', unit: 'min', min: 0, max: 32, decimals: 1, mode: 'pressure' },
    alerts: { label: 'Operational alerts', shortLabel: 'Alerts', unit: 'open', min: 0, max: 10, decimals: 0, mode: 'pressure' }
  };

  const state = {
    data: null,
    mallId: null,
    floorId: null,
    metric: 'visits',
    area: 'all',
    search: '',
    selectedSectionId: null,
    live: {},
    liveTimer: null
  };

  const els = {
    mallSelect: byId('mallSelect'),
    floorTabs: byId('floorTabs'),
    metricSelect: byId('metricSelect'),
    areaFilter: byId('areaFilter'),
    searchBox: byId('searchBox'),
    resetBtn: byId('resetBtn'),
    liveToggle: byId('liveToggle'),
    floorSummary: byId('floorSummary'),
    mapTitle: byId('mapTitle'),
    legend: byId('legend'),
    mapStage: byId('mapStage'),
    mallMap: byId('mallMap'),
    tooltip: byId('tooltip'),
    sectionTitle: byId('sectionTitle'),
    sectionBadge: byId('sectionBadge'),
    metricCards: byId('metricCards'),
    chartTitle: byId('chartTitle'),
    chartUnit: byId('chartUnit'),
    trendChart: byId('trendChart'),
    topicCode: byId('topicCode'),
    deviceList: byId('deviceList')
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    state.data = await loadData();
    state.mallId = state.data.malls[0].id;
    state.floorId = state.data.malls[0].floors[0].id;
    state.selectedSectionId = getCurrentFloor().sections[0].id;
    bindEvents();
    renderControls();
    renderAll();
  }

  async function loadData() {
    try {
      const response = await fetch('mall-data.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load JSON');
      return await response.json();
    } catch (error) {
      const fallback = byId('fallback-data');
      return JSON.parse(fallback.textContent);
    }
  }

  function bindEvents() {
    els.mallSelect.addEventListener('change', () => {
      state.mallId = els.mallSelect.value;
      state.floorId = getCurrentMall().floors[0].id;
      state.selectedSectionId = getCurrentFloor().sections[0].id;
      state.area = 'all';
      state.search = '';
      renderControls();
      renderAll();
    });

    els.metricSelect.addEventListener('change', () => {
      state.metric = els.metricSelect.value;
      renderAll();
    });

    els.areaFilter.addEventListener('change', () => {
      state.area = els.areaFilter.value;
      const candidate = getVisibleSections()[0] || getCurrentFloor().sections[0];
      state.selectedSectionId = candidate.id;
      renderAll();
    });

    els.searchBox.addEventListener('input', () => {
      state.search = els.searchBox.value.trim().toLowerCase();
      renderAll();
    });

    els.resetBtn.addEventListener('click', () => {
      state.metric = 'visits';
      state.area = 'all';
      state.search = '';
      state.selectedSectionId = getCurrentFloor().sections[0].id;
      els.metricSelect.value = state.metric;
      els.searchBox.value = '';
      renderControls();
      renderAll();
    });

    els.liveToggle.addEventListener('change', () => {
      if (els.liveToggle.checked) startLiveSimulation();
      else stopLiveSimulation();
    });

    window.addEventListener('resize', () => {
      renderDetails();
    });
  }

  function renderControls() {
    els.mallSelect.innerHTML = '';
    state.data.malls.forEach((mall) => {
      const option = document.createElement('option');
      option.value = mall.id;
      option.textContent = `${mall.name} - ${mall.city}`;
      option.selected = mall.id === state.mallId;
      els.mallSelect.append(option);
    });

    renderFloorTabs();
    renderAreaFilter();
    els.metricSelect.value = state.metric;
    els.areaFilter.value = state.area;
  }

  function renderFloorTabs() {
    els.floorTabs.innerHTML = '';
    getCurrentMall().floors.forEach((floor) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = floor.id;
      button.title = floor.name;
      button.className = floor.id === state.floorId ? 'active' : '';
      button.addEventListener('click', () => {
        state.floorId = floor.id;
        state.area = 'all';
        state.search = '';
        state.selectedSectionId = floor.sections[0].id;
        els.searchBox.value = '';
        renderControls();
        renderAll();
      });
      els.floorTabs.append(button);
    });
  }

  function renderAreaFilter() {
    const floor = getCurrentFloor();
    const areas = Array.from(new Set(floor.sections.map((section) => section.area))).sort();
    els.areaFilter.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All areas';
    els.areaFilter.append(allOption);

    areas.forEach((area) => {
      const option = document.createElement('option');
      option.value = area;
      option.textContent = area;
      els.areaFilter.append(option);
    });
  }

  function renderAll() {
    renderSummary();
    renderLegend();
    renderMap();
    renderDetails();
  }

  function renderSummary() {
    const sections = getCurrentFloor().sections;
    const totals = {
      visits: sum(sections, 'visits'),
      workers: sum(sections, 'workers'),
      alerts: sum(sections, 'alerts'),
      queue: avg(sections, 'queue')
    };

    els.floorSummary.innerHTML = [
      summaryHtml('Visits / h', formatNumber(totals.visits, 0)),
      summaryHtml('Workers', formatNumber(totals.workers, 0)),
      summaryHtml('Open alerts', formatNumber(totals.alerts, 0)),
      summaryHtml('Avg queue', `${formatNumber(totals.queue, 1)} min`)
    ].join('');
  }

  function summaryHtml(label, value) {
    return `<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function renderLegend() {
    const def = metricDefs[state.metric];
    els.legend.innerHTML = `
      <div class="legend-title">${def.label}: low to high</div>
      <div class="legend-bar"></div>
      <div class="legend-row"><span>${formatNumber(def.min, def.decimals)}</span><span>${formatNumber(def.max, def.decimals)} ${def.unit}</span></div>
    `;
  }

  function renderMap() {
    const mall = getCurrentMall();
    const floor = getCurrentFloor();
    els.mapTitle.textContent = `${mall.name} - ${floor.name}`;
    els.mallMap.innerHTML = '';

    drawBase(floor);

    const visibleSections = getVisibleSections();
    const allSections = floor.sections
      .slice()
      .sort((a, b) => polygonDepth(a.polygon) - polygonDepth(b.polygon));

    allSections.forEach((section) => {
      const visible = visibleSections.includes(section);
      drawSection(section, visible);
    });
  }

  function drawBase(floor) {
    const basePoints = [[0, 0], [floor.width, 0], [floor.width, floor.depth], [0, floor.depth]];
    const projected = basePoints.map(project);
    const base = svgEl('polygon', {
      points: pointsAttr(projected),
      fill: 'rgba(148, 163, 184, 0.12)',
      stroke: 'rgba(255, 255, 255, 0.12)',
      'stroke-width': 2,
      class: 'floor-base'
    });
    els.mallMap.append(base);

    for (let x = 0; x <= floor.width; x += 80) {
      const a = project([x, 0]);
      const b = project([x, floor.depth]);
      els.mallMap.append(svgEl('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        class: 'grid-line'
      }));
    }
    for (let y = 0; y <= floor.depth; y += 80) {
      const a = project([0, y]);
      const b = project([floor.width, y]);
      els.mallMap.append(svgEl('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        class: 'grid-line'
      }));
    }

    const levelTag = svgEl('text', {
      x: 48,
      y: 54,
      fill: 'rgba(255, 255, 255, 0.50)',
      'font-size': 17,
      'font-weight': 800
    });
    levelTag.textContent = `Level ${floor.level}`;
    els.mallMap.append(levelTag);
  }

  function drawSection(section, visible) {
    const def = metricDefs[state.metric];
    const value = getMetricValue(section, state.metric);
    const norm = normalize(value, def.min, def.max);
    const height = 14 + norm * 68;
    const color = colorFor(norm);
    const bottom = section.polygon.map(project);
    const top = bottom.map((point) => ({ x: point.x, y: point.y - height }));
    const isSelected = section.id === state.selectedSectionId;
    const isSearchMiss = state.search && !matchesSearch(section);
    const opacity = visible && !isSearchMiss ? 1 : 0.20;

    for (let i = 0; i < top.length; i += 1) {
      const next = (i + 1) % top.length;
      const shade = i % 2 === 0 ? 0.72 : 0.60;
      const side = svgEl('polygon', {
        points: pointsAttr([top[i], top[next], bottom[next], bottom[i]]),
        fill: hsla(color.h, color.s, Math.round(color.l * shade), 0.82 * opacity),
        class: 'section-side'
      });
      els.mallMap.append(side);
    }

    const topPoly = svgEl('polygon', {
      points: pointsAttr(top),
      fill: hsla(color.h, color.s, color.l, 0.94 * opacity),
      class: `section-top${isSelected ? ' selected' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${section.name} ${formatMetric(value, state.metric)}`,
      'data-section-id': section.id
    });

    topPoly.addEventListener('click', () => selectSection(section.id));
    topPoly.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectSection(section.id);
      }
    });
    topPoly.addEventListener('mouseenter', (event) => showTooltip(event, section));
    topPoly.addEventListener('mousemove', moveTooltip);
    topPoly.addEventListener('mouseleave', hideTooltip);
    els.mallMap.append(topPoly);

    if (opacity > 0.45) drawLabel(section, top, value);
  }

  function drawLabel(section, topPoints, value) {
    const centroid = centroidOf(topPoints);
    const metricText = formatMetric(value, state.metric);
    const width = Math.max(76, Math.min(146, (metricText.length + section.code.length) * 7.8));
    const group = svgEl('g', { class: 'section-label' });
    group.append(svgEl('rect', {
      x: centroid.x - width / 2,
      y: centroid.y - 26,
      width,
      height: 36,
      rx: 10,
      ry: 10
    }));
    const line1 = svgEl('text', { x: centroid.x, y: centroid.y - 12 });
    line1.textContent = section.code;
    const line2 = svgEl('text', { x: centroid.x, y: centroid.y + 3, class: 'label-muted' });
    line2.textContent = metricText;
    group.append(line1, line2);
    els.mallMap.append(group);
  }

  function renderDetails() {
    const section = getSelectedSection() || getCurrentFloor().sections[0];
    if (!section) return;

    const floor = getCurrentFloor();
    els.sectionTitle.textContent = section.name;
    els.sectionBadge.textContent = `${floor.id} / ${section.code}`;

    els.metricCards.innerHTML = Object.keys(metricDefs).map((key) => {
      const def = metricDefs[key];
      const active = key === state.metric ? ' active' : '';
      return `
        <button type="button" class="metric-card${active}" data-metric="${key}">
          <span>${def.shortLabel}</span>
          <strong>${formatMetric(getMetricValue(section, key), key)}</strong>
        </button>
      `;
    }).join('');

    els.metricCards.querySelectorAll('button[data-metric]').forEach((button) => {
      button.addEventListener('click', () => {
        state.metric = button.dataset.metric;
        els.metricSelect.value = state.metric;
        renderAll();
      });
    });

    const metricDef = metricDefs[state.metric];
    els.chartTitle.textContent = `${metricDef.label} - last 12 hours`;
    els.chartUnit.textContent = metricDef.unit;
    drawTrend(section, state.metric);

    els.topicCode.textContent = `mall/${getCurrentMall().id}/floor/${floor.id}/section/${section.id}/worker/+`;
    els.deviceList.textContent = `Mapped worker devices: ${section.devices.join(', ')}`;
  }

  function drawTrend(section, key) {
    const canvas = els.trendChart;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, rect.width) * dpr;
    canvas.height = 180 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);

    const data = getHistory(section, key);
    if (!data.length) return;

    const def = metricDefs[key];
    const pad = { left: 42, right: 16, top: 16, bottom: 30 };
    const min = Math.min(def.min, ...data);
    const max = Math.max(def.max * 0.25, ...data);
    const range = Math.max(1, max - min);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const y = pad.top + (plotH / 3) * i;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
    }
    ctx.stroke();

    const points = data.map((value, index) => ({
      x: pad.left + (plotW / Math.max(1, data.length - 1)) * index,
      y: pad.top + plotH - ((value - min) / range) * plotH,
      value
    }));

    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, 'rgba(103, 232, 249, 0.28)');
    gradient.addColorStop(1, 'rgba(103, 232, 249, 0.02)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height - pad.bottom);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, height - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 3;
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#e0fbff';
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(formatNumber(max, def.decimals), 4, pad.top + 4);
    ctx.fillText(formatNumber(min, def.decimals), 4, height - pad.bottom + 4);
    ctx.fillText('-11h', pad.left, height - 8);
    ctx.fillText('now', width - pad.right - 24, height - 8);
  }

  function selectSection(sectionId) {
    state.selectedSectionId = sectionId;
    renderAll();
  }

  function showTooltip(event, section) {
    const value = getMetricValue(section, state.metric);
    els.tooltip.innerHTML = `<strong>${section.name}</strong>${section.area}<br>${metricDefs[state.metric].label}: <b>${formatMetric(value, state.metric)}</b>`;
    els.tooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const rect = els.mapStage.getBoundingClientRect();
    els.tooltip.style.left = `${event.clientX - rect.left + 14}px`;
    els.tooltip.style.top = `${event.clientY - rect.top + 14}px`;
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  function startLiveSimulation() {
    if (state.liveTimer) return;
    state.liveTimer = window.setInterval(() => {
      getCurrentMall().floors.forEach((floor) => {
        floor.sections.forEach((section) => {
          Object.keys(metricDefs).forEach((key) => {
            const def = metricDefs[key];
            const current = getMetricValue(section, key);
            const spread = (def.max - def.min) * (key === 'alerts' ? 0.035 : 0.025);
            const next = clamp(current + (Math.random() - 0.46) * spread, def.min, def.max);
            if (!state.live[section.id]) state.live[section.id] = {};
            state.live[section.id][key] = key === 'visits' || key === 'workers' || key === 'alerts' ? Math.round(next) : Math.round(next * 10) / 10;
          });
        });
      });
      renderAll();
    }, 1800);
  }

  function stopLiveSimulation() {
    window.clearInterval(state.liveTimer);
    state.liveTimer = null;
    state.live = {};
    renderAll();
  }

  function getCurrentMall() {
    return state.data.malls.find((mall) => mall.id === state.mallId);
  }

  function getCurrentFloor() {
    return getCurrentMall().floors.find((floor) => floor.id === state.floorId);
  }

  function getSelectedSection() {
    return getCurrentFloor().sections.find((section) => section.id === state.selectedSectionId);
  }

  function getVisibleSections() {
    return getCurrentFloor().sections.filter((section) => {
      const areaOk = state.area === 'all' || section.area === state.area;
      const searchOk = !state.search || matchesSearch(section);
      return areaOk && searchOk;
    });
  }

  function matchesSearch(section) {
    const haystack = `${section.name} ${section.area} ${section.code} ${section.id}`.toLowerCase();
    return haystack.includes(state.search);
  }

  function getMetricValue(section, key) {
    return state.live[section.id] && typeof state.live[section.id][key] === 'number'
      ? state.live[section.id][key]
      : section.metrics[key];
  }

  function getHistory(section, key) {
    const base = section.history[key] || [];
    const current = getMetricValue(section, key);
    if (!base.length) return [current];
    const copy = base.slice();
    copy[copy.length - 1] = current;
    return copy;
  }

  function project(point) {
    const x = point[0];
    const y = point[1];
    return {
      x: (x - y) * 0.78 + 540,
      y: (x + y) * 0.42 + 78
    };
  }

  function polygonDepth(points) {
    return points.reduce((acc, point) => acc + point[0] + point[1], 0) / points.length;
  }

  function centroidOf(points) {
    const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: total.x / points.length, y: total.y / points.length };
  }

  function pointsAttr(points) {
    return points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
  }

  function colorFor(norm) {
    const hue = Math.round(142 - norm * 142);
    return { h: hue, s: 78, l: 52 };
  }

  function hsla(h, s, l, a) {
    return `hsla(${h}, ${s}%, ${l}%, ${a})`;
  }

  function svgEl(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function normalize(value, min, max) {
    return clamp((value - min) / Math.max(1, max - min), 0, 1);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value) {
    return Math.round(value * 10) / 10;
  }

  function sum(sections, key) {
    return sections.reduce((total, section) => total + getMetricValue(section, key), 0);
  }

  function avg(sections, key) {
    return sections.length ? sum(sections, key) / sections.length : 0;
  }

  function formatMetric(value, key) {
    const def = metricDefs[key];
    return `${formatNumber(value, def.decimals)} ${def.unit}`;
  }

  function formatNumber(value, decimals) {
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
})();
