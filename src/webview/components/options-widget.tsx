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
import { classNames } from 'primereact/utils';
import React, { ChangeEventHandler, FocusEventHandler, KeyboardEvent, KeyboardEventHandler, MouseEventHandler } from 'react';
import { TableRenderOptions } from '../columns/column-contribution-service';
import {
    SerializedTableRenderOptions,
} from '../utils/view-types';
import { MultiSelectWithLabel } from './multi-select';

export interface OptionsWidgetProps
    extends Omit<TableRenderOptions, 'scrollingBehavior'>,
    Required<DebugProtocol.ReadMemoryArguments> {
    initialTitle: string;
    updateRenderOptions: (options: Partial<SerializedTableRenderOptions>) => void;
    resetRenderOptions: () => void;
    updateTitle: (title: string) => void;
    updateMemoryArguments: (
        memoryArguments: Partial<DebugProtocol.ReadMemoryArguments>
    ) => void;
    refreshMemory: () => void;
    toggleColumn(id: string, isVisible: boolean): void;
}

interface OptionsWidgetState {
    title: string;
    previousTitle?: string;
    isTitleEditing: boolean;
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

export class OptionsWidget extends React.Component<OptionsWidgetProps, OptionsWidgetState> {
    protected formConfig: FormikConfig<OptionsForm>;
    protected extendedOptions = React.createRef<OverlayPanel>();
    protected labelEditInput = React.createRef<HTMLInputElement>();

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
        this.state = {
            title: this.props.initialTitle,
            isTitleEditing: false,
        };
    }

    protected validate = (values: OptionsForm) => {
        const errors: FormikErrors<OptionsForm> = {};

        if (values.address.trim().length === 0) {
            errors.address = 'Required';
        } else {
            const address = +values.address;
            if (!isNaN(address) && address < 0) {
                errors.address = 'Value needs to be >= 0';
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
            } else if (count <= 0) {
                errors.count = 'Value needs to be > 0';
            }
        }

        return errors;
    };

    componentDidUpdate(prevProps: Readonly<OptionsWidgetProps>, prevState: Readonly<OptionsWidgetState>): void {
        if (this.props.initialTitle !== prevProps.initialTitle) {
            this.setState({ title: this.props.initialTitle });
        }
        if (!prevState.isTitleEditing && this.state.isTitleEditing) {
            this.labelEditInput.current?.focus();
            this.labelEditInput.current?.select();
        }
    }

    override render(): React.ReactNode {
        this.formConfig.initialValues = this.optionsFormValues;
        const isLabelEditing = this.state.isTitleEditing;

        return (
            <div className='memory-options-widget px-4'>
                <div className='title-container'>
                    <InputText
                        ref={this.labelEditInput}
                        type='text'
                        value={this.state.title}
                        onChange={this.handleTitleEdit}
                        onKeyDown={this.handleTitleEditingKeyDown}
                        onBlur={this.confirmEditedTitle}
                        style={{ display: isLabelEditing ? 'block' : 'none' }}
                    />
                    {!isLabelEditing && (
                        <h1 onDoubleClick={this.enableTitleEditing}>{this.state.title}</h1>
                    )}
                    {!isLabelEditing && (
                        <Button
                            type='button'
                            className='edit-label-toggle'
                            icon='codicon codicon-edit'
                            onClick={this.enableTitleEditing}
                            title='Edit view title'
                            aria-label='Edit view title'
                            rounded
                            aria-haspopup
                        />
                    )}
                </div>
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
                        title='Advanced Display Options'
                        rounded
                        aria-label='Advanced Display Options'
                        aria-haspopup
                    ></Button>
                    <OverlayPanel ref={this.extendedOptions}>
                        <Button
                            icon='codicon codicon-discard'
                            className='reset-advanced-options-icon'
                            onClick={this.handleResetAdvancedOptions}
                            title='Reset to Defaults'
                            rounded
                            aria-label='Reset to Defaults'
                            aria-haspopup
                        />
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
                                    onSelectionChanged={this.handleColumnActivationChange}
                                />
                            )}
                            <label
                                htmlFor={InputId.WordsPerGroup}
                                className='advanced-options-label mt-1'
                            >
                                Bytes per Group
                            </label>
                            <Dropdown
                                id={InputId.WordsPerGroup}
                                value={this.props.wordsPerGroup}
                                onChange={this.handleAdvancedOptionsDropdownChange}
                                options={allowedBytesPerGroup}
                                className='advanced-options-dropdown' />
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
                this.props.updateRenderOptions({ wordsPerGroup: Number(value) });
                break;
            case InputId.GroupsPerRow:
                this.props.updateRenderOptions({ groupsPerRow: Number(value) });
                break;
            default: {
                throw new Error(`${id} can not be handled. Did you call the correct method?`);
            }
        }
    }

    protected handleColumnActivationChange: (labelSelected: string, newSelectionState: boolean) => void = (label, state) => this.doHandleColumnActivationChange(label, state);
    doHandleColumnActivationChange(label: string, isVisible: boolean): void {
        const columnState = this.props.columnOptions.find(columnStatus => columnStatus.contribution.label.toLowerCase() === label.toLowerCase());
        const columnId = columnState?.contribution.id;
        if (columnId) {
            this.props.toggleColumn(columnId, isVisible);
        }
    }

    protected handleResetAdvancedOptions: MouseEventHandler<HTMLButtonElement> | undefined = () => this.props.resetRenderOptions();

    protected enableTitleEditing = () => this.doEnableTitleEditing();
    protected doEnableTitleEditing(): void {
        this.setState({ isTitleEditing: true, previousTitle: this.state.title });
    }

    protected disableTitleEditing = () => this.doDisableTitleEditing();
    protected doDisableTitleEditing(): void {
        this.setState({ isTitleEditing: false });
    }

    protected handleTitleEdit: ChangeEventHandler<HTMLInputElement> | undefined = () => this.doHandleTitleEdit();
    protected doHandleTitleEdit(): void {
        if (this.labelEditInput.current) {
            this.setState({ title: this.labelEditInput.current?.value });
        }
    }

    protected handleTitleEditingKeyDown: KeyboardEventHandler<HTMLInputElement> | undefined = event => this.doHandleTitleEditingKeyDown(event);
    protected doHandleTitleEditingKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key === 'Enter' && this.labelEditInput.current) {
            this.doConfirmEditedTitle();
        } else if (event.key === 'Escape') {
            if (this.state.previousTitle) {
                this.setState({ title: this.state.previousTitle });
            }
            this.disableTitleEditing();
        }
    }

    protected confirmEditedTitle: FocusEventHandler<HTMLInputElement> | undefined = () => this.doConfirmEditedTitle();
    protected doConfirmEditedTitle(): void {
        if (this.state.isTitleEditing && this.state.title) {
            this.props.updateTitle(this.state.title);
            this.disableTitleEditing();
        }
    }

}
