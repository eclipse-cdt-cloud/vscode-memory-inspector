/********************************************************************************
 * Copyright (C) 2023 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as React from 'react';

export interface SingleSelectItemProps {
    id: string;
    label: string;
    checked: boolean;
}

interface MultiSelectBarProps {
    items: SingleSelectItemProps[];
    id?: string;
    onSelectionChanged: (labelSelected: string, newSelectionState: boolean) => unknown;
}

export const MultiSelectBar: React.FC<MultiSelectBarProps> = ({ items, onSelectionChanged, id }) => {
    const changeHandler: React.ChangeEventHandler<HTMLInputElement> = React.useCallback(e => {
        onSelectionChanged(e.target.id, e.target.checked);
    }, [onSelectionChanged]);

    return (
        <div className='multi-select-bar' id={id}>
            {items.map(({ label, id: itemId, checked }) => (<LabeledCheckbox
                label={label}
                onChange={changeHandler}
                checked={!!checked}
                id={itemId}
                key={`${label}-${id}-checkbox`}
            />))}
        </div>
    );
};

interface LabeledCheckboxProps {
    label: string;
    id: string;
    onChange: React.ChangeEventHandler;
    checked: boolean;
}

export interface LabelProps { id: string; label: string; disabled?: boolean; classNames?: string[], style?: React.CSSProperties }

export const Label: React.FC<LabelProps> = ({ id, label, disabled, classNames, style }) => {
    const additionalClassNames = classNames ? classNames.join(' ') : '';
    return <label htmlFor={id} className={`${additionalClassNames}${disabled ? ' disabled' : ''}`} style={style}>{label}</label>;
};

const LabeledCheckbox: React.FC<LabeledCheckboxProps> = ({ checked, label, onChange, id }) => (
    <div className='multi-select-checkbox-wrapper' >
        <input
            tabIndex={0}
            type='checkbox'
            id={id}
            className='multi-select-checkbox'
            checked={checked}
            onChange={onChange}
        />
        <Label
            id={id}
            label={label}
            classNames={['multi-select-label', checked ? 'active' : 'inactive']} />
    </div>
);

export const MultiSelectWithLabel: React.FC<LabelProps & MultiSelectBarProps> = ({ id, label, items, onSelectionChanged }) => (
    <>
        <label >{label}</label>
        <MultiSelectBar id={id} items={items} onSelectionChanged={onSelectionChanged} />
    </>
);
