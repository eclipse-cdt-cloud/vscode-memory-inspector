/********************************************************************************
 * Copyright (C) 2023 Ericsson, Arm and others.
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

import type { DebugProtocol } from '@vscode/debugprotocol';
import { Formik, FormikConfig, FormikErrors, FormikProps } from 'formik';
import { Button } from 'primereact/button';
import { Dropdown, DropdownChangeEvent } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { OverlayPanel } from 'primereact/overlaypanel';
import React, { KeyboardEvent } from 'react';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { setMemoryDisplayConfigurationType } from '../../common/messaging';
import { TableRenderOptions } from '../columns/column-contribution-service';
import {
    MemoryDisplayConfigurationChangeRequest,
    SerializedTableRenderOptions,
} from '../utils/view-types';
import { messenger } from '../view-messenger';
import { MultiSelectWithLabel } from './multi-select';
import { classNames } from 'primereact/utils';

export interface OptionsWidgetProps
    extends Omit<TableRenderOptions, 'scrollingBehavior' | 'loadingBehavior'>,
    Required<DebugProtocol.ReadMemoryArguments> {
    updateRenderOptions: (options: Partial<SerializedTableRenderOptions>) => void;
    updateMemoryArguments: (
        memoryArguments: Partial<DebugProtocol.ReadMemoryArguments>
    ) => void;
    refreshMemory: () => void;
    toggleColumn(id: string, active: boolean): void;
}

const enum InputId {
    Address = 'address',
    Offset = 'offset',
    Length = 'length',
    WordsPerGroup = 'words-per-group',
    GroupsPerRow = 'groups-per-row',
}

interface OptionsForm {
    address: string;
    offset: string;
    count: string;
}

const allowedBytesPerGroup = [1, 2, 4, 8, 16];
const allowedGroupsPerRow = [1, 2, 4, 8, 16, 32];

export class OptionsWidget extends React.Component<OptionsWidgetProps, {}> {
    protected formConfig: FormikConfig<OptionsForm>;
    protected extendedOptions = React.createRef<OverlayPanel>();

    protected get optionsFormValues(): OptionsForm {
        return {
            address: this.props.memoryReference,
            offset: this.props.offset.toString(),
            count: this.props.count.toString(),
        };
    }

    constructor(props: OptionsWidgetProps) {
        super(props);

        this.formConfig = {
            initialValues: this.optionsFormValues,
            enableReinitialize: true,
            validate: this.validate,
            onSubmit: () => {
                this.props.refreshMemory();
            },
        };
    }

    protected validate = (values: OptionsForm) => {
        const errors: FormikErrors<OptionsForm> = {};

        if (values.address.trim().length === 0) {
            errors.address = 'Required';
        } else {
            const address = +values.address;
            if (!isNaN(address) && address < 0) {
                errors.address = 'Value needs to be larger than 0';
            }
        }

        if (values.offset.trim().length === 0) {
            errors.offset = 'Required';
        } else {
            const offset = +values.offset;
            if (isNaN(offset)) {
                errors.offset = 'No number provided';
            }
        }

        if (values.count.trim().length === 0) {
            errors.count = 'Required';
        } else {
            const count = +values.count;
            if (isNaN(count)) {
                errors.count = 'No number provided';
            } else if (count < 0) {
                errors.count = 'Value needs to be larger than 0';
            }
        }

        return errors;
    };

    override render(): React.ReactNode {
        this.formConfig.initialValues = this.optionsFormValues;

        return (
            <div className='memory-options-widget px-4'>
                <div className='core-options py-2'>
                    <Formik {...this.formConfig}>
                        {formik => (
                            <form onSubmit={formik.handleSubmit} className='form-options'>
                                <span className='pm-top-label form-texfield-long'>
                                    <label htmlFor={InputId.Address} className='p-inputtext-label'>
                                        Address
                                    </label>
                                    <InputText
                                        id={InputId.Address}
                                        className={classNames({ 'p-invalid': formik.errors.address })}
                                        {...formik.getFieldProps('address')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                    />
                                    {formik.errors.address ?
                                        (<small className='p-invalid'>
                                            {formik.errors.address}
                                        </small>)
                                        : undefined}
                                </span>
                                <span className='pm-top-label form-textfield'>
                                    <label htmlFor={InputId.Offset} className='p-inputtext-label'>
                                        Offset
                                    </label>
                                    <InputText
                                        id={InputId.Offset}
                                        className={classNames({ 'p-invalid': formik.errors.offset })}
                                        {...formik.getFieldProps('offset')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                    />
                                    {formik.errors.offset ?
                                        (<small className='p-invalid'>
                                            {formik.errors.offset}
                                        </small>)
                                        : undefined}
                                </span>
                                <span className='pm-top-label form-textfield'>
                                    <label htmlFor={InputId.Length} className='p-inputtext-label'>
                                        Length
                                    </label>
                                    <InputText
                                        id={InputId.Length}
                                        className={classNames({ 'p-invalid': formik.errors.count })}
                                        {...formik.getFieldProps('count')}
                                        onKeyDown={this.handleKeyDown}
                                        onBlur={ev => this.doHandleBlur(ev, formik)}
                                    />
                                    {formik.errors.count ?
                                        (<small className='p-invalid'>
                                            {formik.errors.count}
                                        </small>)
                                        : undefined}
                                </span>
                                <Button type='submit' disabled={!formik.isValid}>
                                    Go
                                </Button>
                            </form>
                        )}
                    </Formik>
                    <Button
                        className='advanced-options-toggle'
                        icon='codicon codicon-gear'
                        onClick={event =>
                            this.extendedOptions?.current?.toggle(event)
                        }
                        type='button'
                        title='Show all data'
                        aria-label='Show all data'
                        aria-haspopup
                    ></Button>
                    <OverlayPanel ref={this.extendedOptions}>
                        <div className='advanced-options-content'>
                            {!!this.props.columnOptions.length && (
                                <MultiSelectWithLabel
                                    id='column-select'
                                    label='Columns'
                                    items={this.props.columnOptions
                                        .filter(({ configurable }) => configurable)
                                        .map(column => ({
                                            id: column.contribution.id,
                                            label: column.contribution.label,
                                            checked: column.active,
                                        }))}
                                    onSelectionChanged={this.props.toggleColumn}
                                />
                            )}
                            <label
                                htmlFor={InputId.WordsPerGroup}
                                className='advanced-options-label'
                            >
                                Bytes per Group
                            </label>
                            <Dropdown
                                id={InputId.WordsPerGroup}
                                value={this.props.wordsPerGroup}
                                onChange={this.handleAdvancedOptionsDropdownChange}
                                options={allowedBytesPerGroup}
                                className="advanced-options-dropdown" />
                            <label
                                htmlFor={InputId.GroupsPerRow}
                                className='advanced-options-label'
                            >
                                Groups per Row
                            </label>
                            <Dropdown
                                id={InputId.GroupsPerRow}
                                value={this.props.groupsPerRow}
                                onChange={this.handleAdvancedOptionsDropdownChange}
                                options={allowedGroupsPerRow}
                                className="advanced-options-dropdown" />
                        </div>
                    </OverlayPanel>
                </div>
            </div>
        );
    }

    protected doHandleBlur(
        ev: React.FocusEvent<HTMLInputElement>,
        formik: FormikProps<OptionsForm>
    ): void {
        formik.handleBlur(ev);
        const id = ev.currentTarget.id as InputId;
        const value = ev.currentTarget.value;

        this.updateOptions(id, value);
    }

    protected handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void = e => this.doHandleKeyDown(e);
    protected doHandleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.code === 'Enter') {
            const id = event.currentTarget.id as InputId;
            const value = event.currentTarget.value;

            this.updateOptions(id, value);
        }
    }

    protected updateOptions(id: InputId, value: string): void {
        switch (id) {
            case InputId.Address:
                this.props.updateMemoryArguments({
                    memoryReference: value,
                });
                break;
            case InputId.Offset:
                if (!Number.isNaN(value)) {
                    this.props.updateMemoryArguments({
                        offset: Number(value),
                    });
                }
                break;
            case InputId.Length:
                if (!Number.isNaN(value)) {
                    this.props.updateMemoryArguments({
                        count: Number(value),
                    });
                }
                break;
            default: {
                throw new Error(`${id} can not be handled. Did you call the correct method?`);
            }
        }
    }

    protected handleAdvancedOptionsDropdownChange: (event: DropdownChangeEvent) => void = e => this.doHandleAdvancedOptionsDropdownChange(e);
    protected doHandleAdvancedOptionsDropdownChange(event: DropdownChangeEvent): void {
        const id = event.target.id as InputId;
        const value = event.target.value;

        switch (id) {
            case InputId.WordsPerGroup:
                this.updateConfiguration({
                    id: 'groupings.wordsPerGroup',
                    value: Number(value),
                });
                break;
            case InputId.GroupsPerRow:
                this.updateConfiguration({
                    id: 'groupings.groupsPerRow',
                    value: Number(value),
                });
                break;
            default: {
                throw new Error(`${id} can not be handled. Did you call the correct method?`);
            }
        }
    }

    protected updateConfiguration(
        viewConfigurationChangeRequest: MemoryDisplayConfigurationChangeRequest
    ): void {
        return messenger.sendNotification(
            setMemoryDisplayConfigurationType,
            HOST_EXTENSION,
            viewConfigurationChangeRequest
        );
    }
}
