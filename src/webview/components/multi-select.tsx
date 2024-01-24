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

import { Checkbox, CheckboxChangeEvent } from 'primereact/checkbox';
import * as React from 'react';

export interface SingleSelectItemProps {
    id: string;
    label: string;
    checked: boolean;
}

interface MultiSelectProps {
    items: SingleSelectItemProps[];
    label: string;
    id?: string;
    onSelectionChanged: (labelSelected: string, newSelectionState: boolean) => unknown;
}

const MultiSelectBar: React.FC<MultiSelectProps> = ({ items, onSelectionChanged, id }) => {
    const changeHandler: ((e: CheckboxChangeEvent) => unknown) = React.useCallback(e => {
        const target = e.target as HTMLInputElement;
        if (target) {
            onSelectionChanged(target.id, target.checked);
        }
    }, [onSelectionChanged]);

    return (
        <div className='flex flex-column align-items-start gap-1' id={id}>
            {items.map(({ label, id: itemId, checked }) => (
                <div key={`${label}-${id}-checkbox`} className='flex align-items-center'>
                    <Checkbox
                        tabIndex={0}
                        onChange={changeHandler}
                        checked={!!checked}
                        id={itemId}
                    />
                    <label htmlFor={itemId} className='ml-2'>{label}</label>
                </div>
            ))}
        </div>
    );
};

export const MultiSelectWithLabel: React.FC<MultiSelectProps> = ({ id, label, items, onSelectionChanged }) => (
    <div className='flex flex-column'>
        <label className='multi-select-label mb-2'>{label}</label>
        <MultiSelectBar id={id} items={items} onSelectionChanged={onSelectionChanged} label={label} />
    </div>
);
