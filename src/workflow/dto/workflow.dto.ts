import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsOptional,
} from 'class-validator';

// Node Data DTO
export class NodeDataDto {
  @ApiProperty({ example: 'Start Process' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'start' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'Initiates the workflow' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'play' })
  @IsString()
  icon: string;

  @ApiProperty()
  @IsString()
  config: string; // Changed to string as it's JSON stringified from frontend
}

// Node DTO
export class NodeDto {
  @ApiProperty({ example: '1' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'workflowNode' })
  @IsString()
  type: string;

  @ApiProperty({ example: 1.9729884098671846 })
  @IsNumber()
  positionX: number;

  @ApiProperty({ example: 120.425753895658 })
  @IsNumber()
  positionY: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => NodeDataDto)
  data: NodeDataDto;

  @ApiProperty({ example: 225 })
  @IsNumber()
  width: number;

  @ApiProperty({ example: 66 })
  @IsNumber()
  height: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  selected: boolean;

  @ApiProperty({ example: 1.9729884098671846 })
  @IsNumber()
  positionAbsoluteX: number;

  @ApiProperty({ example: 120.425753895658 })
  @IsNumber()
  positionAbsoluteY: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  dragging: boolean;
}

// Edge DTO
export class EdgeDto {
  @ApiProperty({
    example: 'reactflow__edge-1-24e987c5-2f8a-47d2-95dc-c7619552dc8f',
  })
  @IsString()
  id: string;

  @ApiProperty({ example: 'smoothstep' })
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  style: string; // Changed to string as it's JSON stringified from frontend

  @ApiProperty({ example: '1' })
  @IsString()
  source: string;

  @ApiProperty({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  sourceHandle: string | null;

  @ApiProperty({ example: '24e987c5-2f8a-47d2-95dc-c7619552dc8f' })
  @IsString()
  target: string;

  @ApiProperty({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  targetHandle: string | null;

  @ApiProperty({ example: true })
  @IsBoolean()
  animated: boolean;
}

// Combined Workflow DTO
export class CreateWorkflowDto {
  @ApiProperty({ example: 'My Workflow' })
  @IsString()
  name: string;

  @ApiProperty({ type: [NodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes: NodeDto[];

  @ApiProperty({ type: [EdgeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges: EdgeDto[];
}
