import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, X } from 'lucide-react';

const DateTimePicker = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef(null);

  // Parse the datetime-local format value (YYYY-MM-DDTHH:mm)
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);

        let hours = date.getHours();
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;

        setSelectedHour(hours.toString().padStart(2, '0'));
        setSelectedMinute(date.getMinutes().toString().padStart(2, '0'));
        setSelectedPeriod(period);
        setCurrentMonth(date);
      }
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const formatDisplayValue = () => {
    if (!selectedDate) return '';

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');

    return `${month}/${day}/${year} ${selectedHour}:${selectedMinute} ${selectedPeriod}`;
  };

  const emitValue = (date, hour, minute, period) => {
    if (!date) return;

    const newDate = new Date(date);
    let hours24 = parseInt(hour);

    if (period === 'PM' && hours24 !== 12) {
      hours24 += 12;
    } else if (period === 'AM' && hours24 === 12) {
      hours24 = 0;
    }

    newDate.setHours(hours24);
    newDate.setMinutes(parseInt(minute));
    newDate.setSeconds(0);

    // Format to datetime-local string (YYYY-MM-DDTHH:mm)
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    const hrs = String(newDate.getHours()).padStart(2, '0');
    const mins = String(newDate.getMinutes()).padStart(2, '0');

    const datetimeLocal = `${year}-${month}-${day}T${hrs}:${mins}`;
    onChange(datetimeLocal);
  };

  const handleDateClick = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    emitValue(newDate, selectedHour, selectedMinute, selectedPeriod);
  };

  const handleHourChange = (hour) => {
    setSelectedHour(hour);
    if (selectedDate) {
      emitValue(selectedDate, hour, selectedMinute, selectedPeriod);
    }
  };

  const handleMinuteChange = (minute) => {
    setSelectedMinute(minute);
    if (selectedDate) {
      emitValue(selectedDate, selectedHour, minute, selectedPeriod);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    if (selectedDate) {
      emitValue(selectedDate, selectedHour, selectedMinute, period);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedDate(null);
    setSelectedHour('12');
    setSelectedMinute('00');
    setSelectedPeriod('AM');
    onChange('');
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return { firstDay, daysInMonth };
  };

  const renderCalendar = () => {
    const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = selectedDate &&
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === currentMonth.getMonth() &&
        selectedDate.getFullYear() === currentMonth.getFullYear();

      const isToday = new Date().getDate() === day &&
        new Date().getMonth() === currentMonth.getMonth() &&
        new Date().getFullYear() === currentMonth.getFullYear();

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(day)}
          className={`h-8 w-8 rounded-full text-sm font-medium transition-colors
            ${isSelected
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : isToday
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'text-gray-700 hover:bg-gray-100'
            }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent text-sm cursor-pointer bg-white flex items-center justify-between"
      >
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
            {formatDisplayValue() || 'Select date and time'}
          </span>
        </div>
        {selectedDate && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Picker Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-[320px]">
          {/* Calendar Section */}
          <div className="mb-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={previousMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-gray-800">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>
          </div>

          {/* Time Selection */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Time</span>
            </div>

            <div className="flex gap-2">
              {/* Hour Dropdown */}
              <select
                value={selectedHour}
                onChange={(e) => handleHourChange(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {hours.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>

              <span className="flex items-center text-gray-500 font-semibold">:</span>

              {/* Minute Dropdown */}
              <select
                value={selectedMinute}
                onChange={(e) => handleMinuteChange(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {minutes.map(minute => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>

              {/* AM/PM Dropdown */}
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
