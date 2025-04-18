import { useState, useEffect } from 'preact/hooks';
import "./ConfProgram.css";

const sectionNames = [
    'Секция аналитической химии и химии окружающей среды',
    'Секция органической химии',
    'Секция физической химии веществ и материалов',
    'Секция физикохимии полимерных и коллоидных систем'
];

const sectionsHaveSubsections = [2];

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

function PresentationCard({ presentation, checked, onCheck }) {
    const presentationTypeClasses = {
        'пленарный' : 'presentation--plenary',
        'устный' : 'presentation--oral',
        'стендовый' : 'presentation--poster'
    }
    const presentationClass = `presentation ${presentationTypeClasses[presentation.type]} presentation--section-${presentation.sectionNumber}`;
    const checkboxID = presentation.id + '-checkbox';
    const presentationPdfLink = <a href={`/docs/2025/abstracts/${presentation.page}.pdf`} target="_blank"><img src='/img/pdf-svgrepo-com.svg' alt="Ссылка на тезисы доклада"></img></a>;
    return (
        <div id={presentation.id} class={presentationClass}>
        <span class="presentation__number">{presentation.number}</span>
        <span class="presentation__title" dangerouslySetInnerHTML={createMarkup(presentation.title)}></span>
        <span class="presentation__authors" dangerouslySetInnerHTML={createMarkup(presentation.authors)}></span>
        <span class="presentation__affil">{presentation.affil}</span>
        <span class="presentation__pdf">{presentation.page != 0 && presentationPdfLink}</span>
        <span class="check presentation__check">
            <label htmlFor={checkboxID}>Отметить</label>
            <input type="checkbox" 
                   id={checkboxID} 
                   name={checkboxID} 
                   checked={checked} 
                   onChange={c => onCheck(c.target.checked, presentation.id)} />
        </span>
        </div>
    );
}

function FilteredProgram({ presentations, filter, checkedPresentations, onCheckPresentation }) {
    const substring = filter.text.trim();
    const isSubstring = where => (where.toLowerCase().indexOf(substring) !== -1);
    const isSubstringOfHtml = where => (where.replace(/<[^>]*>/g, '').toLowerCase().indexOf(substring) !== -1);
    const shouldDisplay = a => (
        (!filter.checked || checkedPresentations.includes(a.id)) &&
        (filter.section === -1 || filter.section === a.sectionNumber) &&
        (filter.subsection === 0 || filter.subsection === a.subsectionNumber || a.subsectionNumber === 0) &&
        (filter.type === 'все' || filter.type === a.type) &&
        (isSubstring(a.number) || isSubstringOfHtml(a.title) || isSubstringOfHtml(a.authors)));
    const elements = [];
    let lastSectionNumber = null;
    let lastSubsectionNumber = null;
    presentations.forEach(a => {
        if (shouldDisplay(a)) {
            if (a.sectionNumber !== lastSectionNumber) {
                elements.push(<h2 className="section-name">{sectionNames[a.sectionNumber]}</h2>);
            }
            if (a.subsectionNumber > 0 && a.subsectionNumber !== lastSubsectionNumber) {
                elements.push(<h3 className="subsection-name">{`Подсекция ${a.subsectionNumber}`}</h3>);
            }
            elements.push(<PresentationCard key={a.id} 
                                            presentation={a} 
                                            checked={checkedPresentations.includes(a.id)} 
                                            onCheck={onCheckPresentation} />);
            lastSectionNumber = a.sectionNumber;
            lastSubsectionNumber = a.subsectionNumber;
        }
    });
    return <>{elements}</>;
}

export default function ConfProgram({ presentations }) {
    const defaultFilter = {
        text: "",
        section: -1,
        subsection: 0,
        type: "все",
        checked: false
    };
    const [filter, setFilter] = useState(defaultFilter);
    const [checkedPresentations, setCheckedPresentations] = useState([]);
    useEffect(()=>{
        //"run this only once" hack
        if (storageAvailable("localStorage")) {
            const storedFilterText = localStorage.getItem('filter');
            if (storedFilterText) {
                handleFilter({
                    ...defaultFilter,
                    ...JSON.parse(storedFilterText)
                });
            }
            const storedCheckedOnes = localStorage.getItem('checked');
            if (storedCheckedOnes) {
                //todo: add cleanup for nonexistent presentation IDs in localStorage
                setCheckedPresentations(JSON.parse(storedCheckedOnes));
            }
        }
    }, []);
    function handleFilter(newFilter) {
        if (storageAvailable("localStorage")) {
            localStorage.setItem("filter", JSON.stringify(newFilter));
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
        const newSubsection = sectionsHaveSubsections.includes(newSection) ? filter.subsection : 0;
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
            localStorage.setItem("checked", JSON.stringify(newCheckedPresentations));
        }
    }
    return (
        <>
            <div class="filter-wrapper">
                <input class="filter-input"
                       type="text"
                       placeholder="фильтр (№, авторы или название)"
                       value={filter.text}
                       onInput={e => handleFilterText(e.target.value)}
                       onKeyUp={e => {
                         if (e.code === 'Enter' || e.keyCode === 13) {
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
                        <option value="0">Все подсекции</option>
                        <option value="1">Подсекция 1</option>
                        <option value="2">Подсекция 2</option>
                    </select>
                }
                <select class="filter-select"
                        name="presentation-type"
                        value={filter.type}
                        onChange={e => handleFilterType(e.target.value)} >
                    <option value="все">Все доклады</option>
                    <option value="пленарный">Пленарные</option>
                    <option value="устный">Устные</option>
                    <option value="стендовый">Стендовые</option>
                </select>
                <span class="check filter-check">
                    <label for="filter-check">Отображать только отмеченные</label>
                    <input type="checkbox"
                           id="filter-check"
                           name="filter-check"
                           checked={filter.checked}
                           onChange={e => handleFilterChecked(e.target.checked)} />
                </span>
            </div>
            <FilteredProgram presentations={presentations}
                             filter={filter}
                             checkedPresentations={checkedPresentations}
                             onCheckPresentation={handleCheckPresentation} />
        </>
    );
}