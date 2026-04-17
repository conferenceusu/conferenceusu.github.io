import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import "./ConfProgram.css";

const sectionNames = [
    'Доклады в день открытия конференции',
    'Секция физикохимии полимерных и коллоидных систем',
    'Секция аналитической химии и химии окружающей среды',
    'Секция физической химии веществ и материалов',
    'Секция органической химии',
];

const sectionLetters = ['П', 'Ф', 'А', 'Т', 'О'];

const subsectionNames = [
    'Подсекция 1',
    'Подсекция 2',
];

const sectionsHaveSubsections = [3];

const conferenceYear = 2026;
const localStorageFilterName = `filter-${conferenceYear}`;
const localStorageCheckedName = `checked-${conferenceYear}`;

const backendProgramEndpoint = 'https://api.064329.xyz/prog/'; //'http://127.0.0.1:8000/prog/'; // 

function createMarkup(html) {
    return {__html: html};
}

function storageAvailable(type) {
    //copied 'as is' from MDN
    let storage;
    try {
      storage = window[type];
      const x = "__storage_test__";
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (e) {
      return (
        e instanceof DOMException &&
        // everything except Firefox
        (e.code === 22 ||
          // Firefox
          e.code === 1014 ||
          // test name field too, because code might not be present
          // everything except Firefox
          e.name === "QuotaExceededError" ||
          // Firefox
          e.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
        // acknowledge QuotaExceededError only if there's something already stored
        storage &&
        storage.length !== 0
      );
    }
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Yekaterinburg'
});

function PresentationCard({ presentation, checked, onCheck }) {
    const presentationClass = `presentation presentation--${presentation.type} presentation--section-${presentation.section}`;
    const checkboxID = presentation.id + '-checkbox';
    const presentationLink = <a href={`/docs/2026/abstracts/${presentation.page.toString().padStart(3, '0')}.html`} target="_blank"><img src='/img/article_shortcut.svg' alt="Ссылка на тезисы доклада" /></a>;
    let presentationNumberText = null;
    switch(presentation.type) {
        case 'plenary':
            presentationNumberText = 'П';
            if (presentation.section === 0) {
                presentationNumberText += `-${presentation.number}`
            }
            break;
        case 'oral':
            presentationNumberText = presentation.number.toString();
            break;
        case 'poster':
            presentationNumberText = `${sectionLetters[presentation.section]}-${presentation.number}`;
            break;
        case 'extra':
            presentationNumberText = `${sectionLetters[presentation.section]}з-${presentation.number}`;
            break;
        default:
            break;
    }
    let presentationStatusText = null;
    const times = [presentation.time_started,
                    presentation.time_finished
        ].map(dateText => dateText ? timeFormatter.format(new Date(dateText)) : null).filter(Boolean);
    const timesText = times.length ? ` (${times.join(' - ')})` : '';
    if (presentation.type === 'plenary' || presentation.type === 'oral') {
        switch(presentation.status) {
            case 'current':
                presentationStatusText = <><span class="hourglass">⏳</span><span> Докладывается...{timesText}</span></>;
                break;
            case 'delivered':
                presentationStatusText = `✅ Доклад состоялся${timesText}`;
                break;
            case 'cancelled':
                presentationStatusText = '❌ Доклад отменен';
                break;
            case undefined:
                break;
            case 'scheduled':
                //break;
            default:
                presentationStatusText = '📅 Доклад запланирован';
                break;
        }
    }
    return (
        <div id={presentation.id} class={presentationClass}>
        <span class="presentation__number">{presentationNumberText}</span>
        <span class="presentation__title" dangerouslySetInnerHTML={createMarkup(presentation.title)}></span>
        <span class="presentation__authors">{presentation.authors}</span>
        <span class="presentation__affs">{presentation.affs}</span>
        <span class="presentation__html">{presentationLink}</span>
        <span class="check presentation__check">
            <label htmlFor={checkboxID}>Отметить</label>
            <input type="checkbox" 
                   id={checkboxID} 
                   name={checkboxID} 
                   checked={checked} 
                   onChange={c => onCheck(c.target.checked, presentation.id)} />
        </span>
        {presentationStatusText && <span class="presentation__status">{presentationStatusText}</span>}
        </div>
    );
}

function FilteredProgram({ presentations, filter, checkedPresentations, onCheckPresentation, isLive }) {
    const substring = filter.text.trim();
    const isSubstring = where => (where.toLowerCase().indexOf(substring) !== -1);
    const isSubstringOfHtml = where => (where.replace(/<[^>]*>/g, '').toLowerCase().indexOf(substring) !== -1);
    const shouldDisplay = a => (
        (!isLive || !filter.current || a.status === 'current') &&
        (!filter.checked || checkedPresentations.includes(a.id)) &&
        (filter.section === -1 || filter.section === a.section) &&
        (
            filter.subsection === -1 || 
            (sectionsHaveSubsections.includes(filter.section) && filter.type === 'poster') || 
            filter.subsection === a.subsection
        ) &&
        (filter.type === 'все' || filter.type === a.type) &&
        (isSubstringOfHtml(a.title) || isSubstring(a.authors))
    ); // a hack - posters are not divided by subsections!
    const filteredPresentations = useMemo(() => {
        //console.log('memo');
        return presentations.filter(shouldDisplay);
    }, [presentations, filter, isLive]);
    let lastSection = null;
    let lastSubsection = null;
    return filteredPresentations.map(a => {
        let sectionHeader = null;
        let subsectionHeader = null;
        if (a.section !== lastSection) {
            sectionHeader = <h2 className="section-name">{sectionNames[a.section]}</h2>;
            lastSection = a.section;
        }
        if (a.subsection !== undefined && a.subsection !== lastSubsection) {
            subsectionHeader = <h3 className="subsection-name">{subsectionNames[a.subsection]}</h3>;
            lastSubsection = a.subsection;
        }
        return <>
            {sectionHeader}
            {subsectionHeader}
            <PresentationCard key={a.id} 
                              presentation={a} 
                              checked={checkedPresentations.includes(a.id)} 
                              onCheck={onCheckPresentation} />
        </>;
    });
}

export default function ConfProgram({ staticProgram }) {
    const [presentations, setPresentations] = useState(staticProgram);
    const defaultFilter = {
        text: "",
        section: -1,
        subsection: -1,
        type: "все",
        checked: false,
        current: false
    };
    const [filter, setFilter] = useState(defaultFilter);
    const [checkedPresentations, setCheckedPresentations] = useState([]);
    useEffect(()=>{
        //"run this only once" hack
        if (storageAvailable("localStorage")) {
            const storedFilterText = localStorage.getItem(localStorageFilterName);
            if (storedFilterText) {
                handleFilter({
                    ...defaultFilter,
                    ...JSON.parse(storedFilterText)
                });
            }
            const storedCheckedOnes = localStorage.getItem(localStorageCheckedName);
            if (storedCheckedOnes) {
                setCheckedPresentations(JSON.parse(storedCheckedOnes));
            }
        }
    }, []);
    const [isLive, setIsLive] = useState(false);
    const lastEtag = useRef(null);
    useEffect(() => {
        async function fetchLiveStatuses() {
            let success = false;
            try {
                const response = await fetch(backendProgramEndpoint);
                if (!response.ok) throw new Error("Server unreachable");
                const etag = response.headers.get('ETag');
                if (etag && etag !== lastEtag.current) {
                    //console.log('fetched new');
                    const liveStatuses = await response.json();
                    const updatedPresentations = presentations.map(presentation => {
                        if (liveStatuses[presentation.id]) {
                            return { ...presentation, ...liveStatuses[presentation.id] };
                        } else {
                            return { ...presentation, status: 'scheduled' };
                        }
                    });
                    setPresentations(updatedPresentations);
                    lastEtag.current = etag;
                } /*else {
                    console.log(`${etag} fetched old`);
                }*/
                setIsLive(true);
                success = true;
            } catch (e) {
                console.warn("Could not fetch live updates");
                console.warn(e);
                setIsLive(false); 
            } finally {
                return success;
            }
        }

        const interval = (async () => {
            const firstFetchResult = await fetchLiveStatuses();
            return firstFetchResult ? setInterval(fetchLiveStatuses, 20000) : null;
        })();
       
        return () => {
            if (interval) clearInterval(interval);
        };
    }, []);
    function handleFilter(newFilter) {
        if (storageAvailable("localStorage")) {
            localStorage.setItem(localStorageFilterName, JSON.stringify(newFilter));
        }
        setFilter(newFilter);
    }
    function handleFilterText(text) {
        handleFilter({
            ...filter,
            text : text.toLowerCase()
        });
    }
    function handleFilterSection(val) {
        const newSection = parseInt(val);
        const newSubsection = sectionsHaveSubsections.includes(newSection) ? filter.subsection : -1;
        handleFilter({
            ...filter,
            section : newSection,
            subsection : newSubsection
        });
    }
    function handleFilterSubsection(val) {
        handleFilter({
            ...filter,
            subsection : parseInt(val)
        });
    }
    function handleFilterType(text) {
        handleFilter({
            ...filter,
            type : text
        });
    }
    function handleFilterChecked(checked) {
        handleFilter({
            ...filter,
            checked : checked ? true : false
        });
    }
    function handleFilterCurrent(checked) {
        handleFilter({
            ...filter,
            current : checked ? true : false
        });
    }
    function handleCheckPresentation(checked, id) {
        const newCheckedPresentations = [...checkedPresentations];
        if (checked) {
            newCheckedPresentations.push(id);
        } else {
            const i = checkedPresentations.indexOf(id);
            if (i >= 0) {
                newCheckedPresentations.splice(i, 1);
            }
        }
        setCheckedPresentations(newCheckedPresentations);
        if (storageAvailable("localStorage")) {
            localStorage.setItem(localStorageCheckedName, JSON.stringify(newCheckedPresentations));
        }
    }
    return (
        <>
            <div class="filter-wrapper">
                <input class="filter-input"
                       type="text"
                       placeholder="фильтр (авторы или название)"
                       value={filter.text}
                       onInput={e => handleFilterText(e.target.value)}
                       onKeyUp={e => {
                         if (e.code === 'Enter') {
                           e.target.blur();
                         }
                       }}
                       onFocusIn={e => e.target.select()} />
                <select class="filter-select"
                        name="section"
                        value={filter.section}
                        onChange={e => handleFilterSection(e.target.value)} >
                    <option value="-1">Все секции</option>
                    {sectionNames.map((s, i) => <option value={i.toString()}>{s}</option>)}
                </select>
                {sectionsHaveSubsections.includes(filter.section) && 
                    <select class="filter-select"
                            name="subsection"
                            value={filter.subsection}
                            onChange={e => handleFilterSubsection(e.target.value)} >
                        <option value="-1">Все подсекции</option>
                        {subsectionNames.map((s, i) => <option value={i.toString()}>{s}</option>)}
                    </select>
                }
                <select class="filter-select"
                        name="presentation-type"
                        value={filter.type}
                        onChange={e => handleFilterType(e.target.value)} >
                    <option value="все">Все доклады</option>
                    <option value="plenary">Пленарные</option>
                    <option value="oral">Устные</option>
                    <option value="poster">Стендовые</option>
                    <option value="extra">Заочные</option>
                </select>
                <span class="check filter-check">
                    <label for="filter-check">Только отмеченные доклады</label>
                    <input type="checkbox"
                           id="filter-check"
                           name="filter-check"
                           checked={filter.checked}
                           onChange={e => handleFilterChecked(e.target.checked)} />
                </span>
                {isLive && 
                <span class="check filter-check">
                    <label for="filter-current">Только докладывающиеся сейчас</label>
                    <input type="checkbox"
                           id="filter-current"
                           name="filter-current"
                           checked={filter.current}
                           onChange={e => handleFilterCurrent(e.target.checked)} />
                </span>
                }
            </div>
            <FilteredProgram isLive={isLive}
                             presentations={presentations}
                             filter={filter}
                             checkedPresentations={checkedPresentations}
                             onCheckPresentation={handleCheckPresentation} />
        </>
    );
}